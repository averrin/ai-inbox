import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface CoolifyDeployment {
    id: number;
    applicationId: string;
    deploymentUuid: string;
    pullRequestId: number;
    forceRebuild: boolean;
    commit: string | null;
    status: string;
    isWebhook: boolean;
    isApi: boolean;
    createdAt: string;
    updatedAt: string;
    currentProcessId: string | null;
    restartOnly: boolean;
    gitType: string | null;
    serverId: number | null;
    applicationName: string | null;
    serverName: string | null;
    deploymentUrl: string | null;
    destinationId: string | null;
    onlyThisServer: boolean;
    rollback: boolean;
    commitMessage: string | null;
    lastChecked: number;
}

export interface CoolifyDeploymentsData {
    deployments: Record<string, CoolifyDeployment>;
    updatedAt: number;
}

type Listener = (data: CoolifyDeploymentsData | null) => void;
let listeners: Listener[] = [];
let firestoreUnsub: (() => void) | null = null;
let currentData: CoolifyDeploymentsData | null = null;

function notifyListeners(data: CoolifyDeploymentsData | null) {
    currentData = data;
    listeners.forEach(fn => fn(data));
}

function subscribe(uid: string) {
    if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
    }
    const ref = doc(firebaseDb, `users/${uid}/coolify/deployments`);
    firestoreUnsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            notifyListeners(snap.data() as CoolifyDeploymentsData);
        } else {
            notifyListeners(null);
        }
    }, (err) => {
        console.warn('[CoolifyService] Firestore listen error:', err);
    });
}

function unsubscribe() {
    if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
    }
    notifyListeners(null);
}

onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        subscribe(user.uid);
    } else {
        unsubscribe();
    }
});

export function isActiveDeployment(status: string): boolean {
    return status === 'running' || status === 'in_progress' || status === 'queued';
}

export const coolifyService = {
    getData(): CoolifyDeploymentsData | null {
        return currentData;
    },

    addListener(fn: Listener): () => void {
        listeners.push(fn);
        fn(currentData);
        return () => {
            listeners = listeners.filter(l => l !== fn);
        };
    },
};

// --- Applications ---

export interface CoolifyApplication {
    id: number;
    uuid: string;
    name: string;
    fqdn: string | null;
    status: string;
    gitRepository: string | null;
    gitBranch: string | null;
    buildPack: string | null;
    projectUuid?: string | null;
    environmentUuid?: string | null;
    lastChecked: number;
}

export interface CoolifyApplicationsData {
    applications: Record<string, CoolifyApplication>;
    updatedAt: number;
}

export function isAppRunning(status: string): boolean {
    return status.startsWith('running');
}

type AppsListener = (data: CoolifyApplicationsData | null) => void;
let appsListeners: AppsListener[] = [];
let appsFirestoreUnsub: (() => void) | null = null;
let currentAppsData: CoolifyApplicationsData | null = null;

function notifyAppsListeners(data: CoolifyApplicationsData | null) {
    currentAppsData = data;
    appsListeners.forEach(fn => fn(data));
}

function subscribeApps(uid: string) {
    if (appsFirestoreUnsub) {
        appsFirestoreUnsub();
        appsFirestoreUnsub = null;
    }
    const ref = doc(firebaseDb, `users/${uid}/coolify/applications`);
    appsFirestoreUnsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            notifyAppsListeners(snap.data() as CoolifyApplicationsData);
        } else {
            notifyAppsListeners(null);
        }
    }, (err) => {
        console.warn('[CoolifyService] Apps Firestore listen error:', err);
    });
}

onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        subscribeApps(user.uid);
    } else {
        if (appsFirestoreUnsub) { appsFirestoreUnsub(); appsFirestoreUnsub = null; }
        notifyAppsListeners(null);
    }
});

export const coolifyAppsService = {
    getData(): CoolifyApplicationsData | null {
        return currentAppsData;
    },

    addListener(fn: AppsListener): () => void {
        appsListeners.push(fn);
        fn(currentAppsData);
        return () => {
            appsListeners = appsListeners.filter(l => l !== fn);
        };
    },

    async sendCommand(action: 'start' | 'stop' | 'restart', appUuid: string): Promise<void> {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error('Not authenticated');
        const commandsRef = collection(firebaseDb, `users/${user.uid}/coolify/commands/items`);
        await addDoc(commandsRef, {
            action,
            appUuid,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
    },
};
