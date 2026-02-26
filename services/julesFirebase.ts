import { doc, onSnapshot } from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from './firebase';
import { JulesSession, WorkflowRun } from './julesApi';

// Interfaces matching the Python backend models
export interface BackendJulesSession {
    name: string;
    id: string;
    title: string;
    state: string;
    url: string;
    createTime: string;
    updateTime: string;
    githubMetadata?: {
        owner: string;
        repo: string;
        branch: string;
        pullRequestNumber?: number;
    };
}

export interface BackendWatchedRun {
    runId: number;
    name: string;
    headBranch: string;
    headCommitMessage: string;
    status: string;
    conclusion: string | null;
    estimatedDuration: number;
    startTime: number;
    lastChecked: number;
    progress: number;
    artifactUrl?: string;
    htmlUrl: string;
    owner: string;
    repo: string;
}

export function subscribeToJulesSessions(callback: (sessions: JulesSession[]) => void): () => void {
    const user = firebaseAuth.currentUser;
    if (!user) {
        console.warn("No user logged in for subscriptions");
        return () => {};
    }

    const unsub = onSnapshot(doc(firebaseDb, `users/${user.uid}/jules/sessions`), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const sessions: BackendJulesSession[] = data.sessions || [];

            // Map to frontend JulesSession interface
            const mappedSessions: JulesSession[] = sessions.map(s => ({
                name: s.name,
                id: s.id,
                title: s.title,
                state: s.state,
                url: s.url,
                createTime: s.createTime,
                updateTime: s.updateTime,
                githubMetadata: s.githubMetadata ? {
                    owner: s.githubMetadata.owner,
                    repo: s.githubMetadata.repo,
                    branch: s.githubMetadata.branch,
                    pullRequestNumber: s.githubMetadata.pullRequestNumber,
                    repoFullName: `${s.githubMetadata.owner}/${s.githubMetadata.repo}`
                } : undefined
            }));

            callback(mappedSessions);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error subscribing to Jules sessions:", error);
    });

    return unsub;
}

export function subscribeToWatchedRuns(callback: (runs: WorkflowRun[]) => void): () => void {
    const user = firebaseAuth.currentUser;
    if (!user) {
        return () => {};
    }

    const unsub = onSnapshot(doc(firebaseDb, `users/${user.uid}/github/watchedRuns`), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const runsDict: Record<string, BackendWatchedRun> = data.runs || {};
            const runsList = Object.values(runsDict);

            // Map to frontend WorkflowRun interface
            // Note: Backend might send partial data, fill gaps as needed
            const mappedRuns: WorkflowRun[] = runsList.map(r => ({
                id: r.runId,
                name: r.name,
                head_branch: r.headBranch,
                head_sha: '', // Not in backend model currently
                head_commit: {
                    message: r.headCommitMessage,
                    author: { name: '', email: '' } // Missing
                },
                status: r.status,
                conclusion: r.conclusion,
                created_at: new Date(r.startTime).toISOString(),
                updated_at: new Date(r.lastChecked).toISOString(),
                html_url: r.htmlUrl,
                pull_requests: [], // Not explicit in model, inferred elsewhere
                // Add extra fields for artifacts if we want to pass them through
                // The frontend WorkflowRun doesn't have 'artifactUrl', but we can attach it if we extend the type
                // or handle it separately. For now, sticking to standard type.
            }));

            // Sort by creation time desc
            mappedRuns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            callback(mappedRuns);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error("Error subscribing to Watched Runs:", error);
    });

    return unsub;
}
