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
