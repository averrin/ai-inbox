import {
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithCredential,
    signOut
} from 'firebase/auth';
import {
    doc,
    onSnapshot,
    setDoc,
    serverTimestamp,
    getDocFromServer
} from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase';
import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { StoreApi } from 'zustand';

interface SyncTarget {
    name: string;
    store: StoreApi<any>;
    docPath: (uid: string) => string;
    selector: (state: any) => any;
    transformOut: (state: any) => any;
    transformIn: (data: any) => any;
}

export class SyncService {
    private static instance: SyncService;
    private targets: SyncTarget[] = [];
    private unsubscribes: Record<string, (() => void)> = {};
    private isSyncing = false;
    private isApplyingRemote: Record<string, boolean> = {};
    private debounceTimers: Record<string, NodeJS.Timeout> = {};

    private constructor() {
        this.setupTargets();
        onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                console.log('[SyncService] User logged in:', user.uid);
                await this.pullAllFromCloud();
                this.startSync();
            } else {
                console.log('[SyncService] User logged out');
                this.stopSync();
            }
        });
    }

    public static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }

    public async signInWithGoogle(idToken: string) {
        const googleCredential = GoogleAuthProvider.credential(idToken);
        return signInWithCredential(firebaseAuth, googleCredential);
    }

    public async signOut() {
        return signOut(firebaseAuth);
    }

    public getTargets(): string[] {
        return this.targets.map(t => t.name);
    }

    public async getRemoteData(targetName: string): Promise<any> {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error("Not logged in");

        const target = this.targets.find(t => t.name === targetName);
        if (!target) throw new Error(`Target ${targetName} not found`);

        const docRef = doc(firebaseDb, target.docPath(user.uid));
        const snap = await getDocFromServer(docRef);
        return snap.exists() ? snap.data() : null;
    }

    public async setRemoteData(targetName: string, data: any): Promise<void> {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error("Not logged in");

        const target = this.targets.find(t => t.name === targetName);
        if (!target) throw new Error(`Target ${targetName} not found`);

        const docRef = doc(firebaseDb, target.docPath(user.uid));
        await setDoc(docRef, data);
    }

    public getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            userId: firebaseAuth.currentUser?.uid
        };
    }

    private setupTargets() {
        this.targets = [
            {
                name: 'settings',
                store: useSettingsStore,
                docPath: (uid) => `users/${uid}/settings/current`,
                selector: (state) => {
                    const clean: any = {};
                    Object.keys(state).forEach(key => {
                        const val = state[key];
                        if (typeof val !== 'function' && key !== 'cachedReminders') clean[key] = val;
                    });
                    return clean;
                },
                transformOut: (state) => ({
                    updatedAt: serverTimestamp(),
                    data: JSON.stringify({ state, version: 5 }),
                    schemaVersion: 5
                }),
                transformIn: (data) => {
                    if (!data || !data.data) return null;
                    try {
                        const parsed = JSON.parse(data.data);
                        return parsed?.state || null;
                    } catch (e) {
                        console.error('[SyncService:settings] Parse error', e);
                        return null;
                    }
                }
            },
            {
                name: 'eventTypes',
                store: useEventTypesStore,
                docPath: (uid) => `users/${uid}/config/eventTypes`,
                selector: (state) => {
                    const clean: any = {};
                    Object.keys(state).forEach(key => {
                        const val = state[key];
                        if (typeof val !== 'function' && key !== 'isLoaded') clean[key] = val;
                    });
                    return clean;
                },
                transformOut: (state) => {
                    const { eventTypes, ...rest } = state;
                    return {
                        ...rest,
                        types: eventTypes,
                        updatedAt: serverTimestamp()
                    };
                },
                transformIn: (data) => {
                    if (!data) return null;
                    const { types, updatedAt, ...rest } = data;
                    return {
                        ...rest,
                        eventTypes: types || [] // Default to empty array if missing
                    };
                }
            }
        ];
    }

    private startSync() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        const user = firebaseAuth.currentUser;
        if (!user) return;

        this.targets.forEach(target => {
            // 1. Subscribe to local changes -> Push to Cloud
            const unsubStore = target.store.subscribe((state, prevState) => {
                if (this.isApplyingRemote[target.name]) return;

                const cleanState = target.selector(state);
                const cleanPrev = target.selector(prevState);

                if (JSON.stringify(cleanState) !== JSON.stringify(cleanPrev)) {
                    this.debouncedPush(target, cleanState);
                }
            });

            // 2. Subscribe to remote changes -> Pull to Local
            const docRef = doc(firebaseDb, target.docPath(user.uid));
            console.log(`[SyncService] Listening to ${target.name} at:`, docRef.path);

            const unsubFirestore = onSnapshot(docRef, { includeMetadataChanges: true }, (snapshot) => {
                if (snapshot.metadata.hasPendingWrites) return;

                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data) {
                        this.handleRemoteUpdate(target, data);
                    }
                }
            }, (error) => {
                console.warn(`[SyncService:${target.name}] Firestore listen error:`, error);
            });

            this.unsubscribes[target.name] = () => {
                unsubStore();
                unsubFirestore();
            };
        });
    }

    private stopSync() {
        this.isSyncing = false;
        Object.values(this.unsubscribes).forEach(unsub => unsub());
        this.unsubscribes = {};
    }

    private debouncedPush(target: SyncTarget, cleanState: any) {
        if (this.debounceTimers[target.name]) clearTimeout(this.debounceTimers[target.name]);
        this.debounceTimers[target.name] = setTimeout(() => {
            this.pushToCloud(target, cleanState);
        }, 2000);
    }

    private async pushToCloud(target: SyncTarget, cleanState: any) {
        const user = firebaseAuth.currentUser;
        if (!user) return;

        try {
            const docRef = doc(firebaseDb, target.docPath(user.uid));
            const payload = target.transformOut(cleanState);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firestore write TIMEOUT (10s)')), 10000)
            );

            await Promise.race([
                setDoc(docRef, payload),
                timeoutPromise
            ]);

            console.log(`[SyncService:${target.name}] Pushed to cloud SUCCESS`);
        } catch (e: any) {
            console.error(`[SyncService:${target.name}] Push FAILED:`, e.message || e);
        }
    }

    private async pullAllFromCloud() {
        const user = firebaseAuth.currentUser;
        if (!user) return;

        await Promise.all(this.targets.map(target => this.pullTargetFromCloud(target, user)));
    }

    private async pullTargetFromCloud(target: SyncTarget, user: any) {
        try {
            const docRef = doc(firebaseDb, target.docPath(user.uid));
            console.log(`[SyncService:${target.name}] Force-checking server...`);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firestore pull TIMEOUT (10s)')), 10000)
            );

            const docSnap = await Promise.race([
                getDocFromServer(docRef),
                timeoutPromise
            ]) as any;

            if (docSnap.exists()) {
                this.handleRemoteUpdate(target, docSnap.data());
            } else {
                console.log(`[SyncService:${target.name}] No remote data found.`);
                const localState = target.selector(target.store.getState());
                if (Object.keys(localState).length > 0) {
                     console.log(`[SyncService:${target.name}] Pushing local state to empty remote (Migration).`);
                     this.pushToCloud(target, localState);
                }
            }
        } catch (e: any) {
            console.error(`[SyncService:${target.name}] Pull FAILED:`, e.message || e);
        }
    }

    private handleRemoteUpdate(target: SyncTarget, data: any) {
        if (!data) return;

        try {
            const remoteState = target.transformIn(data);
            if (!remoteState) return;

            const currentState = target.store.getState();
            const localClean = target.selector(currentState);

            // Compare robustly
            const diffs: string[] = [];
            const allKeys = new Set([...Object.keys(remoteState), ...Object.keys(localClean)]);

            for (const key of allKeys) {
                if (remoteState[key] === undefined) continue;

                const rv = JSON.stringify(remoteState[key]);
                const lv = JSON.stringify(localClean[key]);
                if (rv !== lv) {
                    diffs.push(`"${key}"`);
                }
            }

            if (diffs.length > 0) {
                console.log(`[SyncService:${target.name}] Applying remote update (${diffs.length} fields changed)`);

                this.isApplyingRemote[target.name] = true;
                try {
                    target.store.setState(remoteState);
                } finally {
                    setTimeout(() => {
                        this.isApplyingRemote[target.name] = false;
                    }, 50);
                }
            }
        } catch (e) {
            console.error(`[SyncService:${target.name}] Failed to process remote update`, e);
        }
    }
}
