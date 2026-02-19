import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithCredential,
    signOut
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    onSnapshot,
    setDoc,
    getDoc,
    serverTimestamp,
    getDocFromCache, // JS SDK uses getDocFromCache / getDocFromServer separately
    getDocFromServer
} from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase';
import { useSettingsStore } from '../store/settings';

export class SyncService {
    private static instance: SyncService;
    private unsubscribeFirestore: (() => void) | null = null;
    private unsubscribeAuth: (() => void) | null = null;
    private unsubscribeStore: (() => void) | null = null;
    private isSyncing = false;
    private isApplyingRemote = false;
    private debounceTimer: NodeJS.Timeout | null = null;

    private constructor() {
        this.unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                console.log('[SyncService] User logged in:', user.uid);
                await this.pullFromCloud();
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

    private startSync() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        const user = firebaseAuth.currentUser;
        if (!user) return;

        // 1. Subscribe to local changes -> Push to Cloud
        this.unsubscribeStore = useSettingsStore.subscribe((state, prevState) => {
            if (this.isApplyingRemote) return;

            // Compare only serializable data keys
            const cleanState: any = {};
            const cleanPrev: any = {};

            Object.keys(state).forEach(key => {
                const val = (state as any)[key];
                if (typeof val !== 'function' && key !== 'cachedReminders') cleanState[key] = val;
            });
            Object.keys(prevState).forEach(key => {
                const val = (prevState as any)[key];
                if (typeof val !== 'function' && key !== 'cachedReminders') cleanPrev[key] = val;
            });

            if (JSON.stringify(cleanState) !== JSON.stringify(cleanPrev)) {
                // Log what changed locally
                Object.keys(cleanState).forEach(key => {
                    const nextV = JSON.stringify(cleanState[key]);
                    const prevV = JSON.stringify(cleanPrev[key]);
                    if (nextV !== prevV) {
                        console.log(`[SyncService] Local change in "${key}": ${prevV} -> ${nextV}`);
                    }
                });
                this.debouncedPush(state);
            }
        });

        // 2. Subscribe to remote changes -> Pull to Local
        const docRef = doc(firebaseDb, 'users', user.uid, 'settings', 'current');
        console.log('[SyncService] Listening to:', docRef.path);

        this.unsubscribeFirestore = onSnapshot(docRef, { includeMetadataChanges: true }, (snapshot) => {

            // Ignore updates that were triggered by local writes
            if (snapshot.metadata.hasPendingWrites) {
                return;
            }

            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data) {
                    this.handleRemoteUpdate(data);
                }
            }
        }, (error) => {
            console.warn('[SyncService] Firestore listen error:', error);
        });
    }

    private stopSync() {
        this.isSyncing = false;
        if (this.unsubscribeFirestore) {
            this.unsubscribeFirestore();
            this.unsubscribeFirestore = null;
        }
        if (this.unsubscribeStore) {
            this.unsubscribeStore();
            this.unsubscribeStore = null;
        }
    }

    private debouncedPush(state: any) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.pushToCloud(state);
        }, 2000);
    }

    private async pushToCloud(state: any) {
        const user = firebaseAuth.currentUser;
        if (!user) return;

        try {
            // Strip functions and cached data
            const cleanState: any = {};
            Object.keys(state).forEach(key => {
                if (typeof state[key] !== 'function' && key !== 'cachedReminders') {
                    cleanState[key] = state[key];
                }
            });

            const docRef = doc(firebaseDb, 'users', user.uid, 'settings', 'current');

            // Wrap in race to detect hanging setDoc
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firestore write TIMEOUT (10s)')), 10000)
            );

            await Promise.race([
                setDoc(docRef, {
                    updatedAt: serverTimestamp(),
                    data: JSON.stringify({ state: cleanState, version: 5 }),
                    schemaVersion: 5
                }),
                timeoutPromise
            ]);

            console.log('[SyncService] Pushed to cloud SUCCESS (settings updated)');
        } catch (e: any) {
            console.error('[SyncService] Push FAILED:', e.message || e);
            if (e.code) console.error('[SyncService] Error Code:', e.code);
            if (e.stack) console.error('[SyncService] Stack:', e.stack);
        }
    }

    // Explicit pull (e.g. on login)
    public async pullFromCloud() {
        const user = firebaseAuth.currentUser;
        if (!user) return;

        try {
            const docRef = doc(firebaseDb, 'users', user.uid, 'settings', 'current');
            console.log('[SyncService] Force-checking server for remote state...');

            // Explicitly fetch from server to verify actual connection/project
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Firestore pull TIMEOUT (10s)')), 10000)
            );

            const docSnap = await Promise.race([
                getDocFromServer(docRef),
                timeoutPromise
            ]) as any;

            if (docSnap.exists()) {
                this.handleRemoteUpdate(docSnap.data());
            } else {
            }
        } catch (e: any) {
            console.error('[SyncService] Pull FAILED:', e.message || e);
            // Only log stack if strictly necessary for debugging specific failures, avoid noise in production
            if (e.code === 'unavailable') {
                console.warn('[SyncService] Firestore unavailable (offline or network issue).');
            }
        }
    }

    private handleRemoteUpdate(data: any | undefined) {
        if (!data || !data.data) return;

        try {
            const parsed = JSON.parse(data.data);
            if (parsed && parsed.state) {
                const currentState = useSettingsStore.getState();

                // Compare only data keys
                const remoteState = parsed.state;
                const localData: any = {};
                Object.keys(currentState).forEach(key => {
                    if (typeof (currentState as any)[key] !== 'function' && key !== 'cachedReminders') {
                        localData[key] = (currentState as any)[key];
                    }
                });

                // Compare keys robustly
                const diffs: string[] = [];
                const allKeys = new Set([...Object.keys(remoteState), ...Object.keys(localData)]);

                for (const key of allKeys) {
                    // Start of fix: If remote doesn't have the key, ignore it (local is newer/more complete)
                    if (remoteState[key] === undefined) continue;

                    const rv = JSON.stringify(remoteState[key]);
                    const lv = JSON.stringify(localData[key]);
                    if (rv !== lv) {
                        diffs.push(`"${key}": Local=${lv}, Remote=${rv}`);
                    }
                }

                if (diffs.length > 0) {
                    console.log(`[SyncService] >>> DETECTED ${diffs.length} CHANGES IN REMOTE STATE <<<`);
                    diffs.forEach(d => console.log(`  [Diff] ${d}`));

                    this.isApplyingRemote = true;
                    try {
                        useSettingsStore.setState(parsed.state);
                    } finally {
                        setTimeout(() => {
                            this.isApplyingRemote = false;
                        }, 50);
                    }
                } else {
                }
            }
        } catch (e) {
            console.error('[SyncService] Failed to process remote update', e);
        }
    }
}
