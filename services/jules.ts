import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore } from '../store/settings';
import {
    WorkflowRun,
    CheckRun,
    Artifact,
    PullRequest,
    SessionOutput,
    SourceContext,
    JulesSession,
    fetchWorkflowRuns,
    fetchChecks,
    fetchArtifacts,
    mergePullRequest,
    fetchPullRequest,
    deleteJulesSession,
    fetchJulesSessions,
    sendMessageToSession
} from './julesApi';

export const JULES_ARTIFACT_TASK = 'CHECK_JULES_ARTIFACTS';
const NOTIFIED_RUNS_KEY = 'jules_notified_runs';

<<<<<<< HEAD
// Re-export types and functions
export {
    WorkflowRun,
    CheckRun,
    Artifact,
    PullRequest,
    SessionOutput,
    SourceContext,
    JulesSession,
    fetchWorkflowRuns,
    fetchChecks,
    fetchArtifacts,
    mergePullRequest,
    fetchPullRequest,
    deleteJulesSession,
    fetchJulesSessions,
    sendMessageToSession
};
=======
const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
});

export interface WorkflowRun {
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: string; // queued, in_progress, completed
    conclusion: string | null; // success, failure, cancelled, skipped, timed_out, action_required
    created_at: string;
    updated_at: string;
    html_url: string;
    pull_requests: {
        id: number;
        number: number;
        url: string;
        head: { ref: string, sha: string, repo: { id: number, url: string, name: string } };
        base: { ref: string, sha: string, repo: { id: number, url: string, name: string } };
    }[];
}

export interface CheckRun {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    started_at: string;
    completed_at: string | null;
}

export interface Artifact {
    id: number;
    name: string;
    size_in_bytes: number;
    url: string;
    archive_download_url: string;
    created_at: string;
    expired: boolean;
}

export async function fetchWorkflowRuns(token: string, owner: string, repo: string, workflowId?: string, limit: number = 10, branch?: string): Promise<WorkflowRun[]> {
    let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;
    if (branch) url += `&branch=${branch}`;
    // If workflowId is provided (filename or ID), we can filter by it.
    // However, the API endpoint for a specific workflow is /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
    // If workflowId is just a filename (e.g. jules.yml), we can try to use it.
    if (workflowId) {
        url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${limit}`;
        if (branch) url += `&branch=${branch}`;
    }

    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        // Fallback: If workflow specific fetch failed (maybe ID invalid), try fetching all runs
        if (workflowId) {
            const fallbackUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;
            const fallbackResponse = await fetch(fallbackUrl, { headers: getHeaders(token) });
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                return data.workflow_runs;
            }
        }
        const text = await response.text();
        throw new Error(`Failed to fetch workflow runs: ${response.status} ${text}`);
    }
    const data = await response.json();
    return data.workflow_runs;
}

export async function fetchChecks(token: string, owner: string, repo: string, ref: string): Promise<CheckRun[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${ref}/check-runs`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        // If checks fail, return empty list instead of throwing
        console.warn(`Failed to fetch checks for ref ${ref}: ${response.status}`);
        return [];
    }
    const data = await response.json();
    return data.check_runs;
}

export async function fetchArtifacts(token: string, owner: string, repo: string, runId: number): Promise<Artifact[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        console.warn(`Failed to fetch artifacts for run ${runId}: ${response.status}`);
        return [];
    }
    const data = await response.json();
    return data.artifacts;
}

export async function mergePullRequest(token: string, owner: string, repo: string, pullNumber: number): Promise<boolean> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({
            merge_method: 'squash' // Prefer squash merge
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to merge PR: ${response.status} ${text}`);
    }

    return true;
}

export async function fetchPullRequest(token: string, owner: string, repo: string, pullNumber: number): Promise<any> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch PR: ${response.status} ${text}`);
    }
    return await response.json();
}
export interface PullRequest {
    url: string;
    title?: string;
    description?: string;
    number?: number;
    merged?: boolean;
    state?: string;
    mergeable?: boolean | null;
    mergeable_state?: string;
}

export interface SessionOutput {
    pullRequest?: PullRequest;
    changeSet?: any;
}

export interface SourceContext {
    source: string;
    githubRepoContext?: {
        startingBranch?: string;
    };
}

export interface JulesSession {
    name: string;
    id: string; // Leaf ID
    title: string;
    state: string; // QUEUED, PLANNING, AWAITING_PLAN_APPROVAL, AWAITING_USER_FEEDBACK, IN_PROGRESS, PAUSED, COMPLETED, FAILED
    url: string;
    createTime: string;
    updateTime: string;
    labels?: Record<string, string>;
    outputs?: SessionOutput[];
    sourceContext?: SourceContext;
    githubMetadata?: {
        pullRequestNumber?: number;
        branch?: string;
        owner?: string;
        repo?: string;
        repoFullName?: string;
    };
}

export async function fetchJulesSessions(apiKey: string, limit: number = 10): Promise<JulesSession[]> {
    const url = `https://jules.googleapis.com/v1alpha/sessions?pageSize=${limit}`;
    const response = await fetch(url, {
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch Jules sessions: ${response.status} ${text}`);
    }

    const data = await response.json();
    const sessions = (data.sessions || []).map((s: any) => {
        const parts = s.name.split('/');
        const id = parts[parts.length - 1];

        const session = s as JulesSession;
        let githubMetadata = session.githubMetadata;

        if (!githubMetadata) {
            // Find pull request in outputs array
            const prOutput = session.outputs?.find(o => o.pullRequest);
            const pr = prOutput?.pullRequest;

            // Extract branch from sourceContext
            const branch = session.sourceContext?.githubRepoContext?.startingBranch;

            // Extract repo info from source resource name: sources/github/owner/repo
            const sourceParts = session.sourceContext?.source?.split('/') || [];
            let owner = sourceParts.length >= 4 ? sourceParts[sourceParts.length - 2] : undefined;
            let repo = sourceParts.length >= 4 ? sourceParts[sourceParts.length - 1] : undefined;
            const repoFullName = owner && repo ? `${owner}/${repo}` : undefined;

            if (pr?.url) {
                // Parse GitHub PR URL: https://github.com/{owner}/{repo}/pull/{number}
                const urlParts = pr.url.split('/');
                if (urlParts.length >= 7 && urlParts[2] === 'github.com' && urlParts[5] === 'pull') {
                    githubMetadata = {
                        owner: urlParts[3],
                        repo: urlParts[4],
                        pullRequestNumber: parseInt(urlParts[6], 10),
                        branch: branch || undefined,
                        repoFullName: `${urlParts[3]}/${urlParts[4]}`,
                    };
                }
            } else if (branch || repoFullName) {
                githubMetadata = {
                    owner,
                    repo,
                    branch,
                    repoFullName,
                };
            }
        }

        return {
            ...session,
            id,
            githubMetadata
        };
    });
    return sessions;
}

export async function sendMessageToSession(apiKey: string, sessionName: string, message: string): Promise<any> {
    const url = `https://jules.googleapis.com/v1alpha/${sessionName}:sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userInput: { text: message }
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${text}`);
    }

    return await response.json();
}
>>>>>>> origin/master

// Background Task Definition
TaskManager.defineTask(JULES_ARTIFACT_TASK, async () => {
    try {
        const storedSettings = await AsyncStorage.getItem('ai-inbox-settings');
        if (!storedSettings) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const { state } = JSON.parse(storedSettings);
        const { julesApiKey, julesGoogleApiKey, julesOwner, julesRepo, julesNotificationsEnabled } = state;

        if (!julesNotificationsEnabled || !julesApiKey || !julesGoogleApiKey || !julesOwner || !julesRepo) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const sessions = await fetchJulesSessions(julesGoogleApiKey);
        if (sessions.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

        const notifiedRunsStr = await AsyncStorage.getItem(NOTIFIED_RUNS_KEY);
        const notifiedRuns: number[] = notifiedRunsStr ? JSON.parse(notifiedRunsStr) : [];
        let newNotification = false;

        const ghToken = julesApiKey; // Re-use jules key if same token

        for (const session of sessions) {
            const metadata = session.githubMetadata;
            if (!metadata || !metadata.owner || !metadata.repo) continue;

            // Check for most recent run associated with this session's PR or branch
            const runs = await fetchWorkflowRuns(ghToken, metadata.owner, metadata.repo, undefined, 1, metadata.branch);
            const latestRun = runs[0];

            if (latestRun &&
                latestRun.status === 'completed' &&
                latestRun.conclusion === 'success' &&
                !notifiedRuns.includes(latestRun.id)) {

                // Fetch artifacts to be sure
                const artifacts = await fetchArtifacts(ghToken, metadata.owner, metadata.repo, latestRun.id);
                if (artifacts.length > 0) {
                    // Trigger notification
                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: 'Jules Artifact Ready',
                            body: `Build finished for "${session.title || latestRun.name}"`,
                            data: {
                                type: 'jules-artifact',
                                runId: latestRun.id,
                                owner: metadata.owner,
                                repo: metadata.repo,
                                sessionName: session.name
                            },
                        },
                        trigger: {
                            channelId: 'jules-artifacts',
                        } as any,
                    });

                    notifiedRuns.push(latestRun.id);
                    newNotification = true;
                }
            }
        }

        if (newNotification) {
            await AsyncStorage.setItem(NOTIFIED_RUNS_KEY, JSON.stringify(notifiedRuns.slice(-50))); // Keep last 50
            return BackgroundFetch.BackgroundFetchResult.NewData;
        }

        return BackgroundFetch.BackgroundFetchResult.NoData;
    } catch (error) {
        console.error("[Jules Task] Error:", error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export async function registerJulesTask() {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(JULES_ARTIFACT_TASK);
    if (!isRegistered) {
        console.log("[Jules] Registering background task...");
        await BackgroundFetch.registerTaskAsync(JULES_ARTIFACT_TASK, {
            minimumInterval: 60 * 15, // 15 minutes
            stopOnTerminate: false,
            startOnBoot: true,
        });
    }
}

export async function unregisterJulesTask() {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(JULES_ARTIFACT_TASK);
    if (isRegistered) {
        console.log("[Jules] Unregistering background task...");
        await BackgroundFetch.unregisterTaskAsync(JULES_ARTIFACT_TASK);
    }
}
