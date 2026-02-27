import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { WorkflowRun, CheckRun, fetchChecks, fetchPullRequest } from '../../../services/jules';
import { downloadAndInstallFromUrl, isArtifactUrlCached, installCachedArtifact } from '../../../utils/artifactHandler';
import { artifactDeps } from '../../../utils/artifactDeps';
import { watcherService, WatchedRunState } from '../../../services/watcherService';
import { Colors } from '../../ui/design-tokens';
import { Card } from '../../ui/Card';
import { CheckStatusItem } from './CheckStatusItem';
import { ArtifactActionButton } from './ArtifactActionButton';

interface WorkflowRunItemProps {
    run: WorkflowRun;
    token: string;
    owner: string;
    repo: string;
    artifactUrl?: string | null;
    initialExpanded?: boolean;
    refreshTrigger?: number;
    embedded?: boolean;
    compact?: boolean;
}

export function WorkflowRunItem({ run, token, owner, repo, artifactUrl, initialExpanded = false, refreshTrigger, embedded = false, compact = false }: WorkflowRunItemProps) {
    const [checks, setChecks] = useState<CheckRun[] | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [cachedArtifactPath, setCachedArtifactPath] = useState<string | null>(null);
    const [checksLoading, setChecksLoading] = useState(false);
    const [expanded, setExpanded] = useState(initialExpanded);
    const [prInactive, setPrInactive] = useState(false);
    const [isWatcherDownloading, setIsWatcherDownloading] = useState(watcherService.isDownloading(run.id));
    const [watcherProgress, setWatcherProgress] = useState(watcherService.getDownloadProgress(run.id));
    const [watchedRunData, setWatchedRunData] = useState<WatchedRunState | undefined>(watcherService.getWatchedRun(run.id));

    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const onDownloadChange = (runId: number, downloading: boolean, prog: number) => {
            if (runId === run.id) {
                setIsWatcherDownloading(downloading);
                setWatcherProgress(prog);
            }
        };
        watcherService.addDownloadListener(onDownloadChange);
        return () => watcherService.removeDownloadListener(onDownloadChange);
    }, [run.id]);

    useEffect(() => {
        const onProgress = (runId: number, _percent: number, _remainingMins: number) => {
            if (runId === run.id) {
                const data = watcherService.getWatchedRun(runId);
                setWatchedRunData(data ? { ...data } : undefined);
            }
        };
        watcherService.addProgressListener(onProgress);
        return () => watcherService.removeProgressListener(onProgress);
    }, [run.id]);

    // Check cache when artifactUrl changes
    useEffect(() => {
        if (artifactUrl) {
            isArtifactUrlCached(String(run.id), artifactDeps).then(setCachedArtifactPath);
        } else {
            setCachedArtifactPath(null);
        }
    }, [artifactUrl, run.id]);

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

    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            setChecks(null);
            setChecksLoading(false);
        }
    }, [refreshTrigger]);

    useEffect(() => {
        if (expanded && !checks && !checksLoading) {
            setChecksLoading(true);
            fetchChecks(token, owner, repo, run.head_sha)
                .then(setChecks)
                .catch(err => console.error("Checks fetch error:", err))
                .finally(() => setChecksLoading(false));
        }
    }, [expanded, run.head_sha, token, owner, repo, checks, checksLoading]);

    const handleDownloadArtifact = async () => {
        if (!artifactUrl) return;

        if (cachedArtifactPath) {
            await installCachedArtifact(cachedArtifactPath, artifactDeps);
            return;
        }

        setProgress(0);
        setStatus('Starting...');
        const path = await downloadAndInstallFromUrl(
            artifactUrl,
            String(run.id),
            run.head_branch || 'unknown',
            setIsDownloading,
            (p) => setProgress(p),
            artifactDeps,
            setStatus,
            token
        );
        setProgress(null);
        setStatus(null);
        if (path) setCachedArtifactPath(path);
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
    let runProgress: number | null = null;
    if (watchedRunData && (run.status === 'in_progress' || run.status === 'queued')) {
        const { percent, remainingMins } = watchedRunData;
        runProgress = percent / 100;
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
                            artifactUrl={artifactUrl ?? null}
                            downloading={isDownloading || isWatcherDownloading}
                            progress={isDownloading ? progress : watcherProgress}
                            status={isDownloading ? status : null}
                            cachedPath={cachedArtifactPath}
                            onPress={handleDownloadArtifact}
                            compact={true}
                        />

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

                {runProgress !== null && (
                    <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 8, marginHorizontal: 0, borderRadius: 1, overflow: 'hidden' }}>
                        <View style={{ height: 3, width: `${Math.round(runProgress * 100)}%`, backgroundColor: 'white', borderRadius: 0 }} />
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
                        artifactUrl={artifactUrl ?? null}
                        downloading={isDownloading || isWatcherDownloading}
                        progress={isDownloading ? progress : watcherProgress}
                        status={isDownloading ? status : null}
                        cachedPath={cachedArtifactPath}
                        onPress={handleDownloadArtifact}
                        compact={false}
                    />

                    <TouchableOpacity onPress={() => setExpanded(!expanded)} className="p-1">
                        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                </View>
            </View>

            {runProgress !== null && (
                <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 8, marginHorizontal: -12, marginBottom: -12, overflow: 'hidden' }}>
                    <View style={{ height: 3, width: `${Math.round(runProgress * 100)}%`, backgroundColor: 'white' }} />
                </View>
            )}

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
