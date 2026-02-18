import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NativeModules, Platform } from 'react-native';
import { WorkflowRun, fetchWorkflowRun, fetchWorkflowRuns, fetchArtifacts, Artifact } from './julesApi';
import { downloadAndInstallArtifact, installCachedArtifact } from '../utils/artifactHandler';
import { artifactDeps } from '../utils/artifactDeps';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const STORAGE_KEY = 'watched_runs';
const INSTALL_CATEGORY = 'INSTALL_ARTIFACT';
const INSTALL_ACTION = 'INSTALL';
const WATCHER_TASK = 'BACKGROUND_WATCHER_TASK';

// Define task in global scope
TaskManager.defineTask(WATCHER_TASK, async () => {
    try {
        await watcherService.init(); // Ensure initialized
        await watcherService.checkRuns();
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

interface WatchedRun {
    run: WorkflowRun;
    token: string;
    owner: string;
    repo: string;
    estimatedDuration: number; // in milliseconds
    startTime: number; // timestamp
    lastStatus: string;
    lastChecked: number;
    artifactPath?: string;
}

class WatcherService {
    private watchedRuns: Record<string, WatchedRun> = {};
    private interval: NodeJS.Timeout | null = null;
    private initialized = false;
    private isChecking = false;

    async init() {
        if (this.initialized) return;

        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.watchedRuns = JSON.parse(stored);
            }

            // Register notification category
            await Notifications.setNotificationCategoryAsync(INSTALL_CATEGORY, [
                {
                    identifier: INSTALL_ACTION,
                    buttonTitle: 'Install',
                    options: {
                        isAuthenticationRequired: false,
                        opensAppToForeground: true,
                    },
                },
            ]);

            // Set up notification channels for Android
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('watcher_progress', {
                    name: 'Watch Progress',
                    importance: Notifications.AndroidImportance.LOW, // No sound/vibration
                    vibrationPattern: [0, 0],
                });
                await Notifications.setNotificationChannelAsync('watcher_result', {
                    name: 'Watch Result',
                    importance: Notifications.AndroidImportance.HIGH, // Sound/vibration
                });
            }

            this.initialized = true;
            this.start();
            this.registerTask();
        } catch (e) {
            console.error("Failed to init WatcherService", e);
        }
    }

    async registerTask() {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(WATCHER_TASK);
            if (!isRegistered) {
                await BackgroundFetch.registerTaskAsync(WATCHER_TASK, {
                    minimumInterval: 60 * 15, // 15 minutes
                    stopOnTerminate: false,
                    startOnBoot: true,
                });
            }
        } catch (e) {
            console.warn("Failed to register background fetch", e);
        }
    }

    async watchRun(run: WorkflowRun, token: string, owner: string, repo: string) {
        // Calculate estimated duration
        let avgDuration = 300000; // Default 5 mins
        try {
            // Fetch recent runs to estimate duration
            // Fetching 20 should be enough to find some successful ones
            const recentRuns = await fetchWorkflowRuns(token, owner, repo, undefined, 20);
            const successfulRuns = recentRuns.filter(r =>
                r.name === run.name &&
                r.conclusion === 'success' &&
                r.status === 'completed'
            );

            if (successfulRuns.length > 0) {
                const totalDuration = successfulRuns.reduce((acc, r) => {
                    const start = new Date(r.created_at).getTime();
                    const end = new Date(r.updated_at).getTime();
                    return acc + (end - start);
                }, 0);
                avgDuration = totalDuration / successfulRuns.length;
            }
        } catch (e) {
            console.warn("Failed to estimate duration", e);
        }

        const watchedRun: WatchedRun = {
            run,
            token,
            owner,
            repo,
            estimatedDuration: avgDuration,
            startTime: new Date(run.created_at).getTime(),
            lastStatus: run.status,
            lastChecked: Date.now()
        };

        this.watchedRuns[run.id] = watchedRun;
        await this.save();

        // Immediate notification update
        const now = Date.now();
        const elapsed = now - watchedRun.startTime;
        const progress = Math.min(0.99, elapsed / watchedRun.estimatedDuration);
        const percent = Math.round(progress * 100);
        const remainingMs = Math.max(0, watchedRun.estimatedDuration - elapsed);
        const remainingMins = Math.ceil(remainingMs / 60000);
        const commitMsg = run.head_commit?.message?.split('\n')[0] || 'No commit message';
        const smallText = `${run.head_branch} • ${percent}% • ~${remainingMins}m left`;
        const body = `${run.head_branch} • ${percent}% • ~${remainingMins}m left\nRepo: ${owner}/${repo}\nCommit: ${commitMsg}`;

        // Fire and forget notification
        this.updateNotification(watchedRun, body, percent, false, smallText).catch(console.error);

        this.checkRuns(); // Immediate check
    }

    async unwatchRun(runId: number) {
        if (this.watchedRuns[runId]) {
            delete this.watchedRuns[runId];
            await this.save();
            await Notifications.dismissNotificationAsync(runId.toString());
        }
    }

    isWatching(runId: number): boolean {
        return !!this.watchedRuns[runId];
    }

    private async save() {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.watchedRuns));
    }

    start() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.checkRuns(), 30000); // Check every 30s
    }

    async checkRuns() {
        if (this.isChecking) return;
        this.isChecking = true;

        try {
            const runIds = Object.keys(this.watchedRuns);
            if (runIds.length === 0) return;

            for (const id of runIds) {
                const item = this.watchedRuns[id];

                // Skip if finished and artifact ready (user hasn't installed yet)
                if (item.artifactPath) continue;

                try {
                    const freshRun = await fetchWorkflowRun(item.token, item.owner, item.repo, parseInt(id));
                    item.run = freshRun;
                    item.lastStatus = freshRun.status;
                    item.lastChecked = Date.now();

                    const now = Date.now();
                    const elapsed = now - item.startTime;

                    if (freshRun.status === 'completed') {
                        if (freshRun.conclusion === 'success') {
                            // Download artifact
                            await this.updateNotification(item, "Downloading artifact...", 100);

                            // Fetch artifacts list
                            const artifacts = await fetchArtifacts(item.token, item.owner, item.repo, parseInt(id));
                            // Select best artifact (reuse logic or simple filter)
                            const artifact = artifacts.find(a => a.name.includes('app-release') || a.name.includes('app-debug')) || artifacts[0];

                            if (artifact) {
                                const path = await downloadAndInstallArtifact(
                                    artifact,
                                    item.token,
                                    freshRun.head_branch,
                                    () => { },
                                    () => { },
                                    artifactDeps,
                                    undefined,
                                    true // Only download
                                );

                                if (path) {
                                    item.artifactPath = path;
                                    await this.updateNotification(item, "Ready to Install", undefined, true);
                                } else {
                                    await this.updateNotification(item, "Artifact download failed");
                                }
                            } else {
                                await this.updateNotification(item, "No artifact found");
                            }
                        } else {
                            await this.updateNotification(item, `Build ${freshRun.conclusion}`);
                            // Remove from watched list eventually, but for now just show notification
                        }
                    } else {
                        // In progress
                        const progress = Math.min(0.99, elapsed / item.estimatedDuration);
                        const percent = Math.round(progress * 100);
                        const remainingMs = Math.max(0, item.estimatedDuration - elapsed);
                        const remainingMins = Math.ceil(remainingMs / 60000);
                        const commitMsg = item.run.head_commit?.message?.split('\n')[0] || 'No commit message';
                        const smallText = `${item.run.head_branch} • ${percent}% • ~${remainingMins}m left`;
                        const body = `${item.run.head_branch} • ${percent}% • ~${remainingMins}m left\nRepo: ${item.owner}/${item.repo}\nCommit: ${commitMsg}`;
                        await this.updateNotification(item, body, percent, false, smallText);
                    }

                    await this.save();

                } catch (e) {
                    console.error(`Failed to check run ${id}`, e);
                }
            }
        } finally {
            this.isChecking = false;
        }
    }

    private async updateNotification(item: WatchedRun, body: string, progress?: number, readyToInstall = false, smallText?: string) {
        // Use native progress bar for Android if progress is available
        if (Platform.OS === 'android' && progress !== undefined) {
            try {
                // Using the run ID as notification ID
                const title = `Build: ${item.run.name}`;
                await NativeModules.ApkInstaller.updateProgress(item.run.id.toString(), title, body, smallText || body, progress);
                return;
            } catch (e) {
                console.warn("Failed to update native progress", e);
                // Fallback to standard notification below
            }
        } else if (Platform.OS === 'android' && progress === undefined) {
            // ensure progress bar is removed
            try {
                await NativeModules.ApkInstaller.cancelProgress(item.run.id.toString());
            } catch (e) {
                console.warn("Failed to cancel native progress", e);
            }
        }

        const isImportant = readyToInstall || body.includes('Failed') || body.includes('Build Success');
        const channelId = isImportant ? 'watcher_result' : 'watcher_progress';

        const content: any = {
            title: `Build: ${item.run.name}`,
            body: body,
            data: {
                runId: item.run.id,
                artifactPath: item.artifactPath,
                action: readyToInstall ? INSTALL_ACTION : undefined,
                type: isImportant ? 'result' : 'progress'
            },
            categoryIdentifier: readyToInstall ? INSTALL_CATEGORY : undefined,
            // Android specific
            channelId: channelId,
            priority: isImportant ? Notifications.AndroidNotificationPriority.HIGH : Notifications.AndroidNotificationPriority.LOW,
            sticky: !isImportant,
            autoDismiss: isImportant,
        };

        await Notifications.scheduleNotificationAsync({
            identifier: item.run.id.toString(),
            content,
            trigger: null, // Show immediately
        });
    }

    async handleNotificationResponse(response: Notifications.NotificationResponse) {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data as any;

        if (actionIdentifier === INSTALL_ACTION && data.artifactPath) {
            await installCachedArtifact(data.artifactPath, artifactDeps);
            // Optionally unwatch after install
            if (data.runId) {
                this.unwatchRun(data.runId);
            }
        }
    }
}

export const watcherService = new WatcherService();
