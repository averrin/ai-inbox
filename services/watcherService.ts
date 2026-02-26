import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NativeModules, Platform, NativeEventEmitter } from 'react-native';
import { WorkflowRun, fetchWorkflowRun, fetchWorkflowRuns, fetchArtifacts, Artifact } from './julesApi';
import { downloadAndInstallArtifact, installCachedArtifact } from '../utils/artifactHandler';
import { artifactDeps } from '../utils/artifactDeps';
import { useSettingsStore } from '../store/settings';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { useEventTypesStore } from '../store/eventTypes';
import { isInInvisibleRange } from '../utils/timeRangeUtils';

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

export interface WatchedRun {
    run: WorkflowRun;
    token: string;
    owner: string;
    repo: string;
    estimatedDuration: number; // in milliseconds
    startTime: number; // timestamp
    lastStatus: string;
    lastChecked: number;
    artifactPath?: string;
    artifactRetries?: number;
}

class WatcherService {
    private watchedRuns: Record<string, WatchedRun> = {};
    private interval: NodeJS.Timeout | null = null;
    private initialized = false;
    private isChecking = false;
    private eventEmitter: NativeEventEmitter | null = null;
    private activeDownloads = new Set<number>();
    private activeDownloadProgress = new Map<number, number>();
    private downloadListeners = new Set<(runId: number, isDownloading: boolean, progress: number) => void>();

    getWatchedRun(runId: number): WatchedRun | undefined {
        return this.watchedRuns[runId];
    }

    isDownloading(runId: number): boolean {
        return this.activeDownloads.has(runId);
    }

    getDownloadProgress(runId: number): number {
        return this.activeDownloadProgress.get(runId) || 0;
    }

    addDownloadListener(callback: (runId: number, isDownloading: boolean, progress: number) => void) {
        this.downloadListeners.add(callback);
    }

    removeDownloadListener(callback: (runId: number, isDownloading: boolean, progress: number) => void) {
        this.downloadListeners.delete(callback);
    }

    private notifyDownloadListeners(runId: number, isDownloading: boolean, progress: number) {
        this.downloadListeners.forEach(cb => cb(runId, isDownloading, progress));
    }

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

                // Listen for heartbeat
                try {
                    const { ApkInstaller } = NativeModules;
                    if (ApkInstaller) {
                        this.eventEmitter = new NativeEventEmitter(ApkInstaller);
                        this.eventEmitter.addListener('watcher-heartbeat', () => {
                            // console.log("[WatcherService] Heartbeat received, checking runs");
                            this.checkRuns();
                        });
                    }
                } catch (e) {
                    console.warn("Failed to setup heartbeat listener", e);
                }
            }

            // Listen for foreground FCM messages
            Notifications.addNotificationReceivedListener(notification => {
                const data = notification.request.content.data;
                if (data && (data.run_id || data.runId)) {
                    // console.log("[WatcherService] Received FCM message", data);
                    this.handleFcmMessage(data);
                }
            });

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
                const { watcherMinInterval } = useSettingsStore.getState();
                await BackgroundFetch.registerTaskAsync(WATCHER_TASK, {
                    minimumInterval: watcherMinInterval,
                    stopOnTerminate: false,
                    startOnBoot: true,
                });
            }
        } catch (e) {
            console.warn("Failed to register background fetch", e);
        }
    }

    async handleFcmMessage(data: any) {
        const runId = parseInt(data.run_id || data.runId);
        if (isNaN(runId)) return;

        const watchedRun = this.watchedRuns[runId];
        if (!watchedRun) {
            // Optionally auto-watch if configured
            return;
        }

        // Parse fields from payload
        // Expected format: { run_id, status, progress, artifact_url, ... }
        const status = data.status;
        const progress = data.progress !== undefined ? parseFloat(data.progress) : undefined;
        const artifactUrl = data.artifact_url;

        // If specific status or progress is provided, update notification immediately
        if (status || progress !== undefined) {
             const percent = progress !== undefined ? Math.round(progress * 100) : undefined;
             const commitMsg = watchedRun.run.head_commit?.message?.split('\n')[0] || 'No commit message';

             let body = `${watchedRun.run.head_branch}`;
             if (percent !== undefined) body += ` • ${percent}%`;
             body += `\nRepo: ${watchedRun.owner}/${watchedRun.repo}\nCommit: ${commitMsg}`;
             if (status) body += `\nStatus: ${status}`;

             const smallText = `${watchedRun.run.head_branch} ${percent !== undefined ? `• ${percent}%` : ''} • ${status || watchedRun.lastStatus}`;
             const chipText = percent !== undefined ? `${percent}%` : undefined;

             this.updateNotification(watchedRun, body, progress, false, smallText, chipText, status).catch(console.error);
        }

        // Handle Artifact Download via FCM
        if ((status === 'success' || status === 'completed') && artifactUrl && !watchedRun.artifactPath) {
            console.log(`[WatcherService] FCM triggered artifact download for ${runId}`);

            // Check if already downloading
            if (this.activeDownloads.has(runId)) return;

            const commitMsg = watchedRun.run.head_commit?.message?.split('\n')[0] || 'No commit message';

            this.activeDownloads.add(runId);
            this.activeDownloadProgress.set(runId, 0);
            this.notifyDownloadListeners(runId, true, 0);

            // Initial notification
            await this.updateNotification(watchedRun, `Downloading artifact... 0%\nCommit: ${commitMsg}`, 0, false, undefined, "0%", "Downloading");

            try {
                // Fetch artifacts to get the full object needed for downloadAndInstallArtifact
                const artifacts = await fetchArtifacts(watchedRun.token, watchedRun.owner, watchedRun.repo, runId);
                const artifact = artifacts.find(a => a.name.includes('app-release') || a.name.includes('app-debug')) || artifacts[0];

                if (artifact) {
                    const path = await downloadAndInstallArtifact(
                        artifact,
                        watchedRun.token,
                        watchedRun.run.head_branch,
                        () => {},
                        (p) => {
                            this.activeDownloadProgress.set(runId, p);
                            this.notifyDownloadListeners(runId, true, p);
                            const percent = Math.round(p * 100);
                            const smallText = `Downloading: ${percent}%`;
                            this.updateNotification(watchedRun, `Downloading artifact... ${percent}%\nCommit: ${commitMsg}`, percent, false, smallText, `${percent}%`, "Downloading").catch(console.error);
                        },
                        artifactDeps,
                        undefined,
                        true // Only download
                    );

                    if (path) {
                        watchedRun.artifactPath = path;
                        await this.updateNotification(watchedRun, `Ready to Install\nCommit: ${commitMsg}`, undefined, true, undefined, undefined, "Success");
                        await this.unwatchRun(runId, false);
                    } else {
                        await this.updateNotification(watchedRun, "Artifact download failed", undefined, false, undefined, undefined, "Failed");
                        await this.unwatchRun(runId, false);
                    }
                } else {
                     await this.updateNotification(watchedRun, "No artifact found via FCM trigger", undefined, false, undefined, undefined, "Failed");
                }
            } catch (e) {
                console.error("FCM Artifact download error", e);
                await this.updateNotification(watchedRun, "Artifact download error", undefined, false, undefined, undefined, "Error");
            } finally {
                this.activeDownloads.delete(runId);
                this.activeDownloadProgress.delete(runId);
                this.notifyDownloadListeners(runId, false, 0);
            }
        }
    }

    async watchRun(run: WorkflowRun, token: string, owner: string, repo: string) {
        // Calculate estimated duration
        let avgDuration = useSettingsStore.getState().watcherEstDuration;
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
        this.updateHeartbeatState();

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
        this.updateNotification(watchedRun, body, percent, false, smallText, `${percent}%`).catch(console.error);

        this.checkRuns(); // Immediate check
    }

    async checkForNewRuns() {
        try {
            const { julesApiKey, julesOwner, julesRepo } = useSettingsStore.getState();

            if (!julesApiKey || !julesOwner || !julesRepo) {
                return;
            }

            const runs = await fetchWorkflowRuns(julesApiKey, julesOwner, julesRepo, undefined, 10);

            for (const run of runs) {
                if (run.status === 'in_progress' || run.status === 'queued') {
                    if (!this.isWatching(run.id)) {
                        console.log(`[WatcherService] Auto-watching run: ${run.id}`);
                        await this.watchRun(run, julesApiKey, julesOwner, julesRepo);
                    }
                }
            }
        } catch (e) {
            console.error("[WatcherService] Failed to check for new runs", e);
        }
    }

    async unwatchRun(runId: number, dismiss = true) {
        if (this.watchedRuns[runId]) {
            delete this.watchedRuns[runId];
            await this.save();
            this.updateHeartbeatState();
            if (dismiss) {
                await Notifications.dismissNotificationAsync(runId.toString());
            }
        }
    }

    isWatching(runId: number): boolean {
        return !!this.watchedRuns[runId];
    }

    private async save() {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.watchedRuns));
    }

    private updateHeartbeatState() {
        if (Platform.OS === 'android') {
            const { ApkInstaller } = NativeModules;
            if (ApkInstaller) {
                const hasRuns = Object.keys(this.watchedRuns).length > 0;
                if (hasRuns) {
                    ApkInstaller.startHeartbeat?.();
                } else {
                    ApkInstaller.stopHeartbeat?.();
                }
            }
        }
    }

    start() {
        if (this.interval) clearInterval(this.interval);

        // Use a long interval (e.g., 1 hour) instead of frequent polling
        // as we now rely on FCM for real-time updates.
        const FALLBACK_POLL_INTERVAL = 3600000; // 1 hour
        this.interval = setInterval(() => this.checkRuns(), FALLBACK_POLL_INTERVAL);

        this.updateHeartbeatState();
        this.checkRuns(); // Initial sync
    }

    async checkRuns() {
        if (this.isChecking) return;
        this.isChecking = true;

        try {
            await this.checkForNewRuns();

            const runIds = Object.keys(this.watchedRuns);
            if (runIds.length === 0) {
                 this.updateHeartbeatState();
                 // Continue to ensure we save/update state if needed, though with 0 runs nothing happens
            }

            // Parallel execution using Promise.all
            await Promise.all(runIds.map(id => this.checkRun(id)));
        } finally {
            this.isChecking = false;
        }
    }

    private async checkRun(id: string) {
        const item = this.watchedRuns[id];
        if (!item) return; // Safety check

        // Skip if finished and artifact ready (user hasn't installed yet)
        if (item.artifactPath) return;

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
                    const commitMsg = freshRun.head_commit?.message?.split('\n')[0] || 'No commit message';

                    // Fetch artifacts list
                    const artifacts = await fetchArtifacts(item.token, item.owner, item.repo, parseInt(id));
                    // Select best artifact (reuse logic or simple filter)
                    const artifact = artifacts.find(a => a.name.includes('app-release') || a.name.includes('app-debug')) || artifacts[0];

                    if (artifact) {
                        let path: string | null = null;
                        this.activeDownloads.add(parseInt(id));
                        this.activeDownloadProgress.set(parseInt(id), 0);
                        this.notifyDownloadListeners(parseInt(id), true, 0);

                        // Initial notification for download start
                        await this.updateNotification(item, `Downloading artifact... 0%\nCommit: ${commitMsg}`, 0, false, undefined, "0%");

                        try {
                            path = await downloadAndInstallArtifact(
                                artifact,
                                item.token,
                                freshRun.head_branch,
                                () => { },
                                (p) => {
                                    this.activeDownloadProgress.set(parseInt(id), p);
                                    this.notifyDownloadListeners(parseInt(id), true, p);
                                    const percent = Math.round(p * 100);
                                    const smallText = `Downloading: ${percent}%`;
                                    // Update notification with progress and commit message
                                    this.updateNotification(item, `Downloading artifact... ${percent}%\nCommit: ${commitMsg}`, percent, false, smallText, `${percent}%`).catch(console.error);
                                },
                                artifactDeps,
                                undefined,
                                true // Only download
                            );
                        } finally {
                            this.activeDownloads.delete(parseInt(id));
                            this.activeDownloadProgress.delete(parseInt(id));
                            this.notifyDownloadListeners(parseInt(id), false, 0);
                        }

                        if (path) {
                            item.artifactPath = path;
                            await this.updateNotification(item, `Ready to Install\nCommit: ${commitMsg}`, undefined, true);
                            // Automatically unwatch but keep notification
                            await this.unwatchRun(parseInt(id), false);
                        } else {
                            await this.updateNotification(item, "Artifact download failed");
                            await this.unwatchRun(parseInt(id), false);
                        }
                    } else {
                        const MAX_RETRIES = 5;
                        const retries = item.artifactRetries || 0;
                        if (retries < MAX_RETRIES) {
                            item.artifactRetries = retries + 1;
                            await this.updateNotification(item, `Waiting for artifacts... (${item.artifactRetries}/${MAX_RETRIES})\nCommit: ${commitMsg}`, 100);
                            await this.save();
                            return;
                        }

                        await this.updateNotification(item, "No artifact found");
                        await this.unwatchRun(parseInt(id), false);
                    }
                } else {
                    await this.updateNotification(item, `Build ${freshRun.conclusion}`);
                    // Automatically unwatch failed runs but keep notification
                    await this.unwatchRun(parseInt(id), false);
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
                await this.updateNotification(item, body, percent, false, smallText, `${percent}%`);
            }

            await this.save();

        } catch (e) {
            console.error(`Failed to check run ${id}`, e);
        }
    }

    private async updateNotification(item: WatchedRun, body: string, progress?: number, readyToInstall = false, smallText?: string, chipText?: string, explicitStatus?: string) {
        // Use explicitStatus to check for importance if provided
        const isImportant = readyToInstall || (body.includes('Failed') || body.includes('Build Success') || (explicitStatus && (explicitStatus.includes('failure') || explicitStatus.includes('success'))));

        // Suppress non-important notifications if in an invisible range
        if (!isImportant) {
            const { ranges } = useEventTypesStore.getState();
            if (isInInvisibleRange(ranges)) {
                return;
            }
        }

        // Use native progress bar for Android if progress is available
        if (Platform.OS === 'android' && progress !== undefined) {
            try {
                // Using the run ID as notification ID
                const title = `Build: ${item.run.name}`;
                await NativeModules.ApkInstaller.updateProgress(item.run.id.toString(), title, body, smallText || body, chipText || "", progress);
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
