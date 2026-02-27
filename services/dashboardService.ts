import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseAuth, firebaseDb } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

// --- Types matching backend models ---

export interface DashboardJulesSession {
    name: string;
    id: string;
    title: string;
    state: string;
    url: string;
    createTime: string;
    updateTime: string;
    githubMetadata: {
        owner: string;
        repo: string;
        branch?: string;
        pullRequestNumber?: number;
    } | null;
}

export interface DashboardRun {
    runId: number;
    name: string;
    headBranch: string;
    headCommitMessage: string | null;
    status: string;
    conclusion: string | null;
    estimatedDuration: number;
    startTime: number;
    lastChecked: number;
    progress: number;
    artifactUrl: string | null;
    htmlUrl: string;
    owner: string;
    repo: string;
    prMerged: boolean | null;
    prState: string | null;
}

export interface DashboardJointSession {
    session: DashboardJulesSession;
    run: DashboardRun | null;
}

export interface DashboardData {
    jointSessions: DashboardJointSession[];
    masterRuns: DashboardRun[];
    updatedAt: number;
}

// Adapter: convert DashboardRun -> WorkflowRun shape expected by child components
export function dashboardRunToWorkflowRun(r: DashboardRun) {
    return {
        id: r.runId,
        name: r.name,
        head_branch: r.headBranch,
        head_sha: '',
        head_commit: { message: r.headCommitMessage ?? '', author: { name: '', email: '' } },
        status: r.status,
        conclusion: r.conclusion,
        created_at: new Date(r.startTime).toISOString(),
        updated_at: new Date(r.lastChecked).toISOString(),
        html_url: r.htmlUrl,
        pull_requests: [],
    };
}

// --- Subscription ---

type Listener = (data: DashboardData | null) => void;
let listeners: Listener[] = [];
let firestoreUnsub: (() => void) | null = null;
let currentData: DashboardData | null = null;

function notifyListeners(data: DashboardData | null) {
    currentData = data;
    listeners.forEach(fn => fn(data));
}

function subscribe(uid: string) {
    if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
    }
    const ref = doc(firebaseDb, `users/${uid}/dashboard/data`);
    firestoreUnsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            notifyListeners(snap.data() as DashboardData);
        } else {
            notifyListeners(null);
        }
    }, (err) => {
        console.warn('[DashboardService] Firestore listen error:', err);
    });
    console.log('[DashboardService] Subscribed to dashboard data for', uid);
}

function unsubscribe() {
    if (firestoreUnsub) {
        firestoreUnsub();
        firestoreUnsub = null;
    }
    notifyListeners(null);
}

// Auto-manage subscription
onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        subscribe(user.uid);
    } else {
        unsubscribe();
    }
});

export const dashboardService = {
    getData(): DashboardData | null {
        return currentData;
    },

    addListener(fn: Listener): () => void {
        listeners.push(fn);
        // Immediately call with current data
        fn(currentData);
        return () => {
            listeners = listeners.filter(l => l !== fn);
        };
    },

    async triggerRefresh(): Promise<void> {
        const user = firebaseAuth.currentUser;
        if (!user) throw new Error('Not authenticated');
        const commandsRef = collection(firebaseDb, `users/${user.uid}/dashboard/commands/items`);
        await addDoc(commandsRef, {
            action: 'refresh',
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        console.log('[DashboardService] Refresh command sent');
    }
};
