import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkflowRun, CheckRun, Artifact, fetchChecks, fetchArtifacts, fetchPullRequest } from '../../../services/jules';
import { downloadAndInstallArtifact, isArtifactCached, installCachedArtifact } from '../../../utils/artifactHandler';
import { artifactDeps } from '../../../utils/artifactDeps';
import { watcherService, WatchedRun } from '../../../services/watcherService';
import { Colors } from '../../ui/design-tokens';
import { MetadataChip } from '../../ui/MetadataChip';
import { Card } from '../../ui/Card';
import { CheckStatusItem } from './CheckStatusItem';
import { ArtifactActionButton } from './ArtifactActionButton';

// Helper to select the best artifact (e.g. app binary)
function getBestArtifact(artifacts: Artifact[]): Artifact | null {
    if (!artifacts || artifacts.length === 0) return null;

    // Sort by creation date descending (newest first)
    const sorted = [...artifacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Priority list for app binaries
    const priorities = ['app-release', 'app-debug', 'release', 'debug', 'build'];

    for (const p of priorities) {
        const match = sorted.find(a => a.name.toLowerCase().includes(p));
        if (match) return match;
    }

    // Default to newest
    return sorted[0];
}

interface WorkflowRunItemProps {
    run: WorkflowRun;
    token: string;
    owner: string;
    repo: string;
    initialExpanded?: boolean;
    refreshTrigger?: number;
    embedded?: boolean;
    compact?: boolean;
}

export function WorkflowRunItem({ run, token, owner, repo, initialExpanded = false, refreshTrigger, embedded = false, compact = false }: WorkflowRunItemProps) {
    const [checks, setChecks] = useState<CheckRun[] | null>(null);
    const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [cachedArtifactPath, setCachedArtifactPath] = useState<string | null>(null);
    const [checksLoading, setChecksLoading] = useState(false);
    const [artifactsLoading, setArtifactsLoading] = useState(false);
    const [expanded, setExpanded] = useState(initialExpanded);
    const [prInactive, setPrInactive] = useState(false);
    const [isWatched, setIsWatched] = useState(watcherService.isWatching(run.id));
    const [isWatcherDownloading, setIsWatcherDownloading] = useState(watcherService.isDownloading(run.id));
    const [watcherProgress, setWatcherProgress] = useState(watcherService.getDownloadProgress(run.id));
    const [watchedRunData, setWatchedRunData] = useState<WatchedRun | undefined>(undefined);

    const spinValue = useRef(new Animated.Value(0)).current;
    const isFetchingRef = useRef(false);

    useEffect(() => {
        const onDownloadChange = (runId: number, downloading: boolean, progress: number) => {
            if (runId === run.id) {
                setIsWatcherDownloading(downloading);
                setWatcherProgress(progress);
            }
        };
        watcherService.addDownloadListener(onDownloadChange);
        return () => watcherService.removeDownloadListener(onDownloadChange);
    }, [run.id]);

    useEffect(() => {
        if (!isWatched) {
            setWatchedRunData(undefined);
            return;
        }

        const updateData = () => {
            const data = watcherService.getWatchedRun(run.id);
            setWatchedRunData(data ? { ...data } : undefined);
        };

        updateData();
        const interval = setInterval(updateData, 1000);
        return () => clearInterval(interval);
    }, [isWatched, run.id]);

    const pr = run.pull_requests && run.pull_requests.length > 0 ? run.pull_requests[0] : null;

    useEffect(() => {
        if (pr) {
            fetchPullRequest(token, owner, repo, pr.number)
                .then(prData => setPrInactive(prData.merged || prData.state === 'merged' || prData.state === 'closed'))
                .catch(err => console.error("Fetch PR detail error:", err));
        }
    }, [pr, token, owner, repo]);

    useEffect(() => {
        const isActive = run.status === 'in_progress' || run.status === 'queued';
        let animation: Animated.CompositeAnimation | null = null;
        if (isActive) {
            animation = Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            );
            animation.start();
        } else {
            spinValue.setValue(0);
        }

        return () => {
            if (animation) animation.stop();
        };
    }, [run.status]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const fetchArtifactsData = useCallback(() => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;
        setArtifactsLoading(true);
        fetchArtifacts(token, owner, repo, run.id)
            .then(setArtifacts)
            .catch(err => console.error("Artifacts fetch error:", err))
            .finally(() => {
                setArtifactsLoading(false);
                isFetchingRef.current = false;
            });
    }, [token, owner, repo, run.id]);

    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            setChecks(null);
            setChecksLoading(false);
            setArtifacts(null);
            fetchArtifactsData();
        }
    }, [refreshTrigger, fetchArtifactsData]);

    useEffect(() => {
        fetchArtifactsData();
    }, [fetchArtifactsData]);

    useEffect(() => {
        if (artifacts && artifacts.length > 0) {
            const artifact = getBestArtifact(artifacts);
            if (artifact) {
                isArtifactCached(artifact, artifactDeps).then(setCachedArtifactPath);
            }
        } else {
            setCachedArtifactPath(null);
        }
    }, [artifacts]);

    useEffect(() => {
        if (expanded) {
            if (!checks && !checksLoading) {
                setChecksLoading(true);
                fetchChecks(token, owner, repo, run.head_sha)
                    .then(setChecks)
                    .catch(err => console.error("Checks fetch error:", err))
                    .finally(() => setChecksLoading(false));
            }

            if (!artifacts && !artifactsLoading) {
                fetchArtifactsData();
            }
        }
    }, [expanded, run.head_sha, run.id, token, owner, repo, checks, artifacts, checksLoading, artifactsLoading, fetchArtifactsData]);

    // Auto-refetch artifacts every 15 seconds if missing
    useEffect(() => {
        let interval: any = null;

        const shouldPoll = !artifacts || artifacts.length === 0;

        if (shouldPoll && !artifactsLoading) {
            interval = setInterval(() => {
                fetchArtifactsData();
            }, 15000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [artifacts, artifactsLoading, fetchArtifactsData]);

    const handleDownloadArtifact = async () => {
        if (!run || !artifacts || artifacts.length === 0 || !token) return;
        const artifact = getBestArtifact(artifacts);
        if (!artifact) return;

        if (cachedArtifactPath) {
            await installCachedArtifact(cachedArtifactPath, artifactDeps);
            return;
        }

        setProgress(0);
        setStatus("Starting...");
        await downloadAndInstallArtifact(
            artifact,
            token,
            run.head_branch || 'unknown',
            setIsDownloading,
            (p) => setProgress(p),
            artifactDeps,
            setStatus
        );
        setProgress(null);
        setStatus(null);
        isArtifactCached(artifact, artifactDeps).then(setCachedArtifactPath);
    };

    const toggleWatch = async () => {
        if (isWatched) {
            await watcherService.unwatchRun(run.id);
            setIsWatched(false);
        } else {
            await watcherService.watchRun(run, token, owner, repo);
            setIsWatched(true);
        }
    };

    const getStatusInfo = () => {
        if (run.status === 'in_progress') return { color: '#60a5fa', icon: 'sync' };
        if (run.status === 'queued') return { color: Colors.text.tertiary, icon: 'time-outline' };

        switch (run.conclusion) {
            case 'success': return { color: '#4ade80', icon: 'checkmark-circle' };
            case 'failure': return { color: '#f87171', icon: 'close-circle' };
            case 'cancelled': return { color: '#fb923c', icon: 'stop-circle-outline' };
            case 'skipped': return { color: Colors.text.tertiary, icon: 'play-skip-forward-outline' };
            case 'timed_out': return { color: '#f87171', icon: 'timer-outline' };
            case 'action_required': return { color: '#facc15', icon: 'alert-circle-outline' };
            default: return { color: Colors.text.tertiary, icon: 'help-circle-outline' };
        }
    };

    const statusInfo = getStatusInfo();
    const prUrl = pr ? `https://github.com/${owner}/${repo}/pull/${pr.number}` : null;
    // Hide PR button if embedded (because parent session card has it)
    const showPrButton = prUrl && !embedded;

    let progressString = "";
    if (watchedRunData && (run.status === 'in_progress' || run.status === 'queued')) {
        const now = Date.now();
        const elapsed = now - watchedRunData.startTime;
        const progress = Math.min(0.99, elapsed / watchedRunData.estimatedDuration);
        const percent = Math.round(progress * 100);
        const remainingMs = Math.max(0, watchedRunData.estimatedDuration - elapsed);
        const remainingMins = Math.ceil(remainingMs / 60000);
        progressString = ` • ${percent}% (~${remainingMins}m left)`;
    }

    const stripeColors: string[] = [];
    const stripeLocations: number[] = [];
    if (prInactive) {
        const step = 0.005;
        for (let i = 0; i < 200; i++) {
            const isColor = i % 2 === 1;
            const c = isColor ? 'rgba(148, 163, 184, 0.12)' : Colors.transparent;
            stripeColors.push(c, c);
            stripeLocations.push(i * step, (i + 1) * step);
        }
    }

    if (embedded) {
        return (
            <View className={`mt-3 pt-3 border-t border-border/60 ${prInactive ? 'opacity-50' : ''}`}>
                <View className="flex-row items-center justify-between mb-1">
                    <TouchableOpacity
                        onPress={() => Linking.openURL(run.html_url)}
                        className="flex-row items-center flex-1"
                    >
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
                        </Animated.View>
                        <View className="ml-3 flex-1">
                            <View className="flex-row items-center">
                                <Text className="text-white font-bold text-sm flex-1" numberOfLines={1}>{run.name}</Text>
                            </View>
                            <Text className="text-secondary text-[10px]">
                                {dayjs(run.created_at).fromNow()} • {run.head_branch}{progressString}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View className="flex-row items-center gap-2">
                        <ArtifactActionButton
                            artifacts={artifacts}
                            loading={artifactsLoading}
                            downloading={isDownloading || isWatcherDownloading}
                            progress={isDownloading ? progress : watcherProgress}
                            status={isDownloading ? status : null}
                            cachedPath={cachedArtifactPath}
                            onPress={handleDownloadArtifact}
                            onFetch={fetchArtifactsData}
                            compact={true}
                        />

                        {(run.status === 'in_progress' || run.status === 'queued' || isWatched) && (
                            <MetadataChip
                                label={isWatched ? "Watching" : "Watch"}
                                icon={isWatched ? "eye" : "eye-outline"}
                                variant={isWatched ? "solid" : "outline"}
                                color={isWatched ? Colors.primary : Colors.text.tertiary}
                                size="sm"
                                onPress={toggleWatch}
                            />
                        )}

                        <TouchableOpacity onPress={() => setExpanded(!expanded)} className="p-1">
                            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {expanded && (
                    <View className="mt-2 border-t border-border pt-2">
                        {run.head_commit?.message && (
                            <View className="mb-2">
                                <Text className="text-secondary text-[10px] font-bold mb-1 uppercase">Commit Message</Text>
                                <Text className="text-white text-[10px] font-mono" numberOfLines={3}>{run.head_commit.message}</Text>
                            </View>
                        )}
                        <Text className="text-secondary text-[10px] font-bold mb-2 uppercase">Checks Status</Text>
                        {checksLoading ? (
                            <ActivityIndicator size="small" color={Colors.text.tertiary} />
                        ) : checks && checks.length > 0 ? (
                            <View>
                                {checks.map(check => (
                                    <CheckStatusItem key={check.id} check={check} compact={true} />
                                ))}
                            </View>
                        ) : (
                            <Text className="text-secondary text-[10px] italic">No checks found</Text>
                        )}
                    </View>
                )}
            </View>
        );
    }

    return (
        <Card
            className={`mb-1 ${prInactive ? 'opacity-50' : ''}`}
            padding="p-3"
            style={{ overflow: 'hidden' }}
            background={prInactive ? (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <LinearGradient
                        colors={stripeColors as any}
                        locations={stripeLocations as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                </View>
            ) : undefined}
        >
            <View className="flex-row items-center justify-between mb-1">
                <TouchableOpacity
                    onPress={() => Linking.openURL(run.html_url)}
                    className="flex-row items-center flex-1"
                >
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
                    </Animated.View>
                    <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>{run.name}</Text>
                        </View>
                        <Text className="text-text-tertiary text-xs">
                            {dayjs(run.created_at).fromNow()} • {run.head_branch}{progressString}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View className="flex-row items-center gap-2">
                    <ArtifactActionButton
                        artifacts={artifacts}
                        loading={artifactsLoading}
                        downloading={isDownloading || isWatcherDownloading}
                        progress={isDownloading ? progress : watcherProgress}
                        status={isDownloading ? status : null}
                        cachedPath={cachedArtifactPath}
                        onPress={handleDownloadArtifact}
                        onFetch={fetchArtifactsData}
                        compact={false}
                    />

                    {(run.status === 'in_progress' || run.status === 'queued' || isWatched) && (
                        <MetadataChip
                            label={isWatched ? "Watching" : "Watch"}
                            icon={isWatched ? "eye" : "eye-outline"}
                            variant={isWatched ? "solid" : "outline"}
                            color={isWatched ? Colors.primary : Colors.text.tertiary}
                            size="sm"
                            onPress={toggleWatch}
                        />
                    )}

                    <TouchableOpacity onPress={() => setExpanded(!expanded)} className="p-1">
                        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                </View>
            </View>

            {expanded && (
                <View className="mt-2 border-t border-border pt-2">
                    <View className="flex-row gap-1 mb-3">
                        {showPrButton && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(prUrl!)}
                                className="flex-1 bg-primary py-2 rounded-lg flex-row items-center justify-center"
                            >
                                <Ionicons name="git-pull-request" size={16} color="white" />
                                <Text className="text-white font-semibold ml-2">Open PR #{pr?.number}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {run.head_commit?.message && (
                        <View className="mb-3">
                            <Text className="text-text-tertiary text-xs font-bold mb-1 uppercase">Commit Message</Text>
                            <Text className="text-white text-xs font-mono">{run.head_commit.message}</Text>
                        </View>
                    )}
                    <Text className="text-text-tertiary text-xs font-bold mb-2 uppercase">Checks Status</Text>
                    {checksLoading ? (
                        <ActivityIndicator size="small" color={Colors.text.tertiary} />
                    ) : checks && checks.length > 0 ? (
                        <View>
                            {checks.map(check => (
                                <CheckStatusItem key={check.id} check={check} />
                            ))}
                        </View>
                    ) : (
                        <Text className="text-secondary text-xs italic">No checks found or loading...</Text>
                    )}
                </View>
            )}
        </Card>
    );
}
