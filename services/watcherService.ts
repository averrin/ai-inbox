import * as Notifications from 'expo-notifications';
import { Platform, NativeModules } from 'react-native';
import { installCachedArtifact } from '../utils/artifactHandler';
import { artifactDeps } from '../utils/artifactDeps';
import { useEventTypesStore } from '../store/eventTypes';
import { isInInvisibleRange } from '../utils/timeRangeUtils';

const INSTALL_CATEGORY = 'INSTALL_ARTIFACT';
const INSTALL_ACTION = 'INSTALL';

// --- Types ---

export interface WatchedRunState {
    runId: number;
    runName: string;
    headBranch: string;
    owner: string;
    repo: string;
    startTime: number;
    estimatedDuration: number;
    percent: number;
    remainingMins: number;
    lastUpdated: number;
}

// --- In-memory state ---

type ProgressListener = (runId: number, percent: number, remainingMins: number) => void;

class RunWatcherService {
    private watchedRuns: Record<number, WatchedRunState> = {};
    private progressListeners = new Set<ProgressListener>();
    private downloadListeners = new Set<(runId: number, isDownloading: boolean, progress: number) => void>();
    private activeDownloads = new Set<number>();
    private activeDownloadProgress = new Map<number, number>();
    private initialized = false;

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        try {
            await Notifications.setNotificationCategoryAsync(INSTALL_CATEGORY, [
                {
                    identifier: INSTALL_ACTION,
                    buttonTitle: 'Install',
                    options: { isAuthenticationRequired: false, opensAppToForeground: true },
                },
            ]);

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('watcher_progress', {
                    name: 'Build Progress',
                    importance: Notifications.AndroidImportance.LOW,
                    vibrationPattern: [0, 0],
                });
                await Notifications.setNotificationChannelAsync('watcher_result', {
                    name: 'Build Result',
                    importance: Notifications.AndroidImportance.HIGH,
                });
            }
        } catch (e) {
            console.error('[RunWatcher] init error', e);
        }
    }

    // --- Public API ---

    isWatching(runId: number): boolean {
        return !!this.watchedRuns[runId];
    }

    isDownloading(runId: number): boolean {
        return this.activeDownloads.has(runId);
    }

    getDownloadProgress(runId: number): number {
        return this.activeDownloadProgress.get(runId) ?? 0;
    }

    getWatchedRun(runId: number): WatchedRunState | undefined {
        return this.watchedRuns[runId];
    }

    addProgressListener(cb: ProgressListener) {
        this.progressListeners.add(cb);
    }

    removeProgressListener(cb: ProgressListener) {
        this.progressListeners.delete(cb);
    }

    addDownloadListener(cb: (runId: number, isDownloading: boolean, progress: number) => void) {
        this.downloadListeners.add(cb);
    }

    removeDownloadListener(cb: (runId: number, isDownloading: boolean, progress: number) => void) {
        this.downloadListeners.delete(cb);
    }

    // Called from _layout FCM handler when a progress message arrives
    handleProgressUpdate(runId: number, percent: number, remainingMins: number, runName: string, headBranch: string, owner: string, repo: string) {
        if (!this.watchedRuns[runId]) {
            this.watchedRuns[runId] = {
                runId, runName, headBranch, owner, repo,
                startTime: Date.now(), estimatedDuration: 0,
                percent, remainingMins, lastUpdated: Date.now(),
            };
        }
        const state = this.watchedRuns[runId];
        state.percent = percent;
        state.remainingMins = remainingMins;
        state.lastUpdated = Date.now();
        this.progressListeners.forEach(cb => cb(runId, percent, remainingMins));
        this._updateProgressNotification(runId, runName || state.runName, headBranch || state.headBranch, percent, remainingMins).catch(console.error);
    }

    // Called from _layout FCM handler when a run completes
    async handleRunCompleted(runId: number, conclusion: string, runName: string, artifactPath?: string) {
        const state = this.watchedRuns[runId];
        const name = (state?.runName) || runName;

        if (conclusion === 'success' && artifactPath) {
            await this._showInstallNotification(runId, name, artifactPath);
        } else {
            await this._showResultNotification(runId, name, conclusion);
        }

        delete this.watchedRuns[runId];
        await Notifications.dismissNotificationAsync(runId.toString());
    }

    // Called from _layout when a download-progress FCM arrives (backend downloading artifact)
    handleDownloadProgress(runId: number, progress: number) {
        if (!this.activeDownloads.has(runId)) {
            this.activeDownloads.add(runId);
        }
        this.activeDownloadProgress.set(runId, progress);
        this.downloadListeners.forEach(cb => cb(runId, true, progress));
    }

    handleDownloadFinished(runId: number) {
        this.activeDownloads.delete(runId);
        this.activeDownloadProgress.delete(runId);
        this.downloadListeners.forEach(cb => cb(runId, false, 0));
    }

    async handleNotificationResponse(response: Notifications.NotificationResponse) {
        const { actionIdentifier, notification } = response;
        const data = notification.request.content.data as any;

        if (actionIdentifier === INSTALL_ACTION && data.artifactPath) {
            await installCachedArtifact(data.artifactPath, artifactDeps);
            if (data.runId) {
                const runId = Number(data.runId);
                delete this.watchedRuns[runId];
                await Notifications.dismissNotificationAsync(runId.toString());
            }
        }
    }

    // --- Private ---

    private async _updateProgressNotification(runId: number, runName: string, headBranch: string, percent: number, remainingMins: number) {
        const isInvisible = isInInvisibleRange(useEventTypesStore.getState().ranges);
        if (isInvisible) return;

        const body = `${headBranch} • ${percent}% • ~${remainingMins}m left`;
        const smallText = body;

        if (Platform.OS === 'android') {
            try {
                await NativeModules.ApkInstaller?.updateProgress(
                    runId.toString(),
                    `Build: ${runName}`,
                    body,
                    smallText,
                    `${percent}%`,
                    percent
                );
                return;
            } catch (e) {
                console.warn('[RunWatcher] Native progress failed, falling back', e);
            }
        }

        await Notifications.scheduleNotificationAsync({
            identifier: runId.toString(),
            content: {
                title: `Build: ${runName}`,
                body,
                data: { runId, type: 'progress' },
                ...(Platform.OS === 'android' && {
                    channelId: 'watcher_progress',
                    priority: Notifications.AndroidNotificationPriority.LOW,
                    sticky: true,
                    autoDismiss: false,
                }),
            },
            trigger: null,
        });
    }

    private async _showInstallNotification(runId: number, runName: string, artifactPath: string) {
        if (Platform.OS === 'android') {
            try {
                await NativeModules.ApkInstaller?.cancelProgress(runId.toString());
            } catch (_) {}
        }
        await Notifications.scheduleNotificationAsync({
            identifier: runId.toString(),
            content: {
                title: `Build Ready: ${runName}`,
                body: 'Tap Install to apply the update.',
                data: { runId, artifactPath, action: INSTALL_ACTION, type: 'result' },
                categoryIdentifier: INSTALL_CATEGORY,
                ...(Platform.OS === 'android' && {
                    channelId: 'watcher_result',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    sticky: false,
                    autoDismiss: true,
                }),
            },
            trigger: null,
        });
    }

    private async _showResultNotification(runId: number, runName: string, conclusion: string) {
        if (Platform.OS === 'android') {
            try {
                await NativeModules.ApkInstaller?.cancelProgress(runId.toString());
            } catch (_) {}
        }
        await Notifications.scheduleNotificationAsync({
            identifier: runId.toString(),
            content: {
                title: `Build ${conclusion}: ${runName}`,
                body: `Workflow run finished with conclusion: ${conclusion}`,
                data: { runId, type: 'result' },
                ...(Platform.OS === 'android' && {
                    channelId: 'watcher_result',
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                }),
            },
            trigger: null,
        });
    }
}

export const watcherService = new RunWatcherService();
