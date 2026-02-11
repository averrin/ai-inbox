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

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
});

export interface GithubUser {
    login: string;
    id: number;
    avatar_url: string;
    name: string;
}

export interface GithubRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    description: string;
    owner: GithubUser;
    default_branch: string;
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: getHeaders(token)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch user: ${response.status} ${text}`);
    }
    return await response.json();
}

export async function fetchGithubRepos(token: string, page: number = 1): Promise<GithubRepo[]> {
    const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&page=${page}`, {
        headers: getHeaders(token)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch repos: ${response.status} ${text}`);
    }
    return await response.json();
}

export async function exchangeGithubToken(clientId: string, clientSecret: string, code: string, redirectUri: string, codeVerifier?: string): Promise<string> {
    console.log(redirectUri)
    const url = 'https://github.com/login/oauth/access_token';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to exchange token: ${response.status} ${text}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`GitHub OAuth Error: ${data.error_description || data.error}`);
    }
    return data.access_token;
}

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
