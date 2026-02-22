import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, ActivityIndicator, StyleSheet, Modal, FlatList, TextInput, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { Card } from '../ui/Card';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { WorkflowRun, fetchWorkflowRuns, CheckRun, fetchChecks, Artifact, fetchArtifacts, JulesSession, fetchJulesSessions, mergePullRequest, fetchPullRequest, exchangeGithubToken, fetchGithubRepos, fetchGithubUser, GithubRepo, sendMessageToSession, fetchGithubRepoDetails } from '../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import { showAlert, showError } from '../../utils/alert';
import Toast from 'react-native-toast-message';

WebBrowser.maybeCompleteAuthSession();
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MessageDialog } from '../ui/MessageDialog';
import { downloadAndInstallArtifact, isArtifactCached, installCachedArtifact } from '../../utils/artifactHandler';
import { artifactDeps } from '../../utils/artifactDeps';
import { watcherService } from '../../services/watcherService';
import { useUIStore } from '../../store/ui';
import { Colors } from '../ui/design-tokens';
import { MetadataChip } from '../ui/MetadataChip';

dayjs.extend(relativeTime);

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

function SessionActionMenu({ visible, onClose, actions }: { visible: boolean, onClose: () => void, actions: { label: string, icon: string, onPress: () => void, color?: string, disabled?: boolean }[] }) {
    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
                <View className="bg-background rounded-t-2xl p-4 pb-10 border-t border-border">
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-surface-highlight rounded-full" />
                    </View>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => {
                                if (!action.disabled) {
                                    action.onPress();
                                    onClose();
                                }
                            }}
                            className={`flex-row items-center py-4 border-b border-border ${action.disabled ? 'opacity-50' : ''}`}
                            disabled={action.disabled}
                        >
                            <Ionicons name={action.icon as any} size={20} color={action.color || "white"} style={{ marginRight: 16 }} />
                            <Text className={`text-base font-medium ${action.color ? '' : 'text-white'}`} style={action.color ? { color: action.color } : {}}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={onClose} className="mt-4 py-3 bg-surface rounded-xl items-center">
                        <Text className="text-white font-bold">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

function RepoSelector({ visible, onClose, onSelect, token }: { visible: boolean, onClose: () => void, onSelect: (repo: GithubRepo) => void, token: string }) {
    const [repos, setRepos] = useState<GithubRepo[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && token) {
            setLoading(true);
            setSearch('');
            fetchGithubRepos(token)
                .then(setRepos)
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [visible, token]);

    const filtered = repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/80 justify-center px-4">
                <View className="bg-background rounded-2xl max-h-[80%] overflow-hidden w-full border border-border">
                    <View className="p-4 border-b border-border flex-row justify-between items-center bg-surface">
                        <Text className="text-white font-bold text-lg">Select Repository</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <View className="p-4 bg-background">
                        <View className="bg-surface rounded-lg flex-row items-center px-3 mb-2 border border-border">
                            <Ionicons name="search" size={20} color={Colors.text.tertiary} />
                            <TextInput
                                className="flex-1 text-white p-3"
                                placeholder="Search repositories..."
                                placeholderTextColor={Colors.text.tertiary}
                                value={search}
                                onChangeText={setSearch}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                    {loading ? (
                        <ActivityIndicator size="large" color="#818cf8" className="my-10" />
                    ) : (
                        <FlatList
                            data={filtered}
                            keyExtractor={item => item.id.toString()}
                            className="bg-background"
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="p-4 border-b border-border flex-row items-center justify-between"
                                    onPress={() => onSelect(item)}
                                >
                                    <View className="flex-1 mr-2">
                                        <Text className="text-white font-medium text-base">{item.full_name}</Text>
                                        {item.description && <Text className="text-secondary text-xs" numberOfLines={1}>{item.description}</Text>}
                                    </View>
                                    {item.private && <Ionicons name="lock-closed" size={14} color={Colors.text.tertiary} />}
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

function CheckStatusItem({ check, compact = false }: { check: CheckRun, compact?: boolean }) {
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const isActive = check.status === 'in_progress' || check.status === 'queued';
        let animation: Animated.CompositeAnimation | null = null;
        if (isActive) {
            animation = Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 1000,
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
    }, [check.status]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const getIcon = () => {
        if (check.status === 'queued') return 'time-outline';
        if (check.status === 'in_progress') return 'sync';
        if (check.conclusion === 'success') return 'checkmark';
        if (check.conclusion === 'failure') return 'close';
        return 'ellipse';
    };

    const getColor = () => {
        if (check.status === 'queued') return Colors.text.tertiary;
        if (check.status === 'in_progress') return '#60a5fa';
        if (check.conclusion === 'success') return '#4ade80';
        if (check.conclusion === 'failure') return '#f87171';
        return Colors.text.tertiary;
    };

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(check.html_url)}
            className={`flex-row items-center justify-between ${compact ? 'mb-0.5' : 'mb-1'}`}
        >
            <View className="flex-row items-center flex-1">
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons
                        name={getIcon() as any}
                        size={14}
                        color={getColor()}
                    />
                </Animated.View>
                <Text className="text-text-secondary text-xs ml-2 flex-1" numberOfLines={1}>{check.name}</Text>
            </View>
            <Text className="text-secondary text-xs">{check.status}</Text>
        </TouchableOpacity>
    );
}

function ArtifactActionButton({
    artifacts,
    loading,
    downloading,
    progress,
    status,
    cachedPath,
    onPress,
    onFetch,
    compact = false
}: {
    artifacts: Artifact[] | null,
    loading: boolean,
    downloading: boolean,
    progress: number | null,
    status: string | null,
    cachedPath: string | null,
    onPress: () => void,
    onFetch: () => void,
    compact?: boolean
}) {
    if (artifacts && artifacts.length > 0) {
        if (downloading) {
            return (
                <MetadataChip
                    label={status || `${Math.round((progress || 0) * 100)}%`}
                    loading={true}
                    progress={progress || 0}
                    variant="default"
                    size={compact ? 'sm' : 'md'}
                    disabled={true}
                />
            );
        }

        return (
            <MetadataChip
                label={cachedPath ? "Install" : "Artifact"}
                icon={cachedPath ? "construct-outline" : "download-outline"}
                variant="default"
                size={compact ? 'sm' : 'md'}
                onPress={onPress}
            />
        );
    }

    if (loading) {
        return (
             <MetadataChip
                label="Checking..."
                loading={true}
                variant="outline"
                color={Colors.text.tertiary}
                size={compact ? 'sm' : 'md'}
            />
        );
    }

    return (
        <MetadataChip
            label="No Artifact"
            icon="alert-circle-outline"
            variant="outline"
            color={Colors.text.secondary}
            size={compact ? 'sm' : 'md'}
            onPress={onFetch}
        />
    );
}

function WorkflowRunItem({ run, token, owner, repo, initialExpanded = false, refreshTrigger, embedded = false, compact = false }: { run: WorkflowRun, token: string, owner: string, repo: string, initialExpanded?: boolean, refreshTrigger?: number, embedded?: boolean, compact?: boolean }) {
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

    const spinValue = useRef(new Animated.Value(0)).current;
    const isFetchingRef = useRef(false);

    useEffect(() => {
        const onDownloadChange = (runId: number, downloading: boolean) => {
            if (runId === run.id) {
                setIsWatcherDownloading(downloading);
            }
        };
        watcherService.addDownloadListener(onDownloadChange);
        return () => watcherService.removeDownloadListener(onDownloadChange);
    }, [run.id]);

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
                                {dayjs(run.created_at).fromNow()} • {run.head_branch}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <View className="flex-row items-center gap-2">
                        <ArtifactActionButton
                            artifacts={artifacts}
                            loading={artifactsLoading}
                            downloading={isDownloading || isWatcherDownloading}
                            progress={progress}
                            status={isDownloading ? status : (isWatcherDownloading ? "Watcher..." : null)}
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
                            {dayjs(run.created_at).fromNow()} • {run.head_branch}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View className="flex-row items-center gap-2">
                    <ArtifactActionButton
                        artifacts={artifacts}
                        loading={artifactsLoading}
                        downloading={isDownloading || isWatcherDownloading}
                        progress={progress}
                        status={isDownloading ? status : (isWatcherDownloading ? "Watcher..." : null)}
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

function JulesSessionItem({ session, matchedRun, ghToken, defaultOwner, defaultRepo, onDelete, onRefresh, julesGoogleApiKey, refreshTrigger }: { session: JulesSession, matchedRun: WorkflowRun | null, ghToken?: string, defaultOwner?: string, defaultRepo?: string, onDelete?: () => void, onRefresh?: () => void, julesGoogleApiKey?: string, refreshTrigger?: number }) {
    const [isMerging, setIsMerging] = useState(false);
    const [prInactive, setPrInactive] = useState(false);
    const [mergeable, setMergeable] = useState<boolean | null>(null);
    const [isMerged, setIsMerged] = useState(false);
    const [isClosed, setIsClosed] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [messageVisible, setMessageVisible] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);

    const spinValue = useRef(new Animated.Value(0)).current;

    const metadata = session.githubMetadata;
    const owner = metadata?.owner || defaultOwner;
    const repo = metadata?.repo || defaultRepo;
    const prNumber = metadata?.pullRequestNumber;

    // We use matchedRun if available, otherwise just basic status
    const ghRun = matchedRun;

    useEffect(() => {
        const isActive = session.state === 'IN_PROGRESS' || session.state === 'PLANNING' || session.state === 'QUEUED';
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
    }, [session.state]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    useEffect(() => {
        if (ghToken && owner && repo && prNumber) {
            fetchPullRequest(ghToken, owner, repo, prNumber)
                .then(pr => {
                    const merged = pr.merged || pr.state === 'merged';
                    const closed = pr.state === 'closed';
                    setIsMerged(merged);
                    setIsClosed(closed && !merged);
                    setPrInactive(merged || closed);
                    setMergeable(pr.mergeable);
                })
                .catch(err => console.error("Fetch PR detail error:", err));
        }
    }, [ghToken, owner, repo, prNumber, refreshTrigger]);

    const handleMerge = async () => {
        if (!ghToken || !owner || !repo || !prNumber) return;

        try {
            setIsMerging(true);
            await mergePullRequest(ghToken, owner, repo, prNumber);
            showAlert("Success", "Pull Request merged successfully");
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error(e);
            showError("Error", "Failed to merge Pull Request");
        } finally {
            setIsMerging(false);
        }
    };

    const handleDelete = () => {
        showAlert(
            "Delete Session",
            "Are you sure you want to delete this session? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: onDelete }
            ]
        );
    };

    const handleSendMessage = async (message: string) => {
        if (!julesGoogleApiKey) return;
        setSendingMessage(true);
        try {
            await sendMessageToSession(julesGoogleApiKey, session.name, message);
            setMessageVisible(false);
            showAlert("Success", "Message sent to session");
        } catch (e: any) {
            console.error("Failed to send message", e);
            showError("Error", e.message || "Failed to send message");
        } finally {
            setSendingMessage(false);
        }
    };

    const getStatusIcon = (state: string) => {
        switch (state) {
            case 'COMPLETED': return { icon: 'checkmark-circle', color: '#4ade80' };
            case 'FAILED': return { icon: 'close-circle', color: '#f87171' };
            case 'IN_PROGRESS':
            case 'PLANNING': return { icon: 'sync', color: '#60a5fa' };
            case 'AWAITING_PLAN_APPROVAL':
            case 'AWAITING_USER_FEEDBACK': return { icon: 'alert-circle', color: '#facc15' };
            case 'QUEUED': return { icon: 'time-outline', color: Colors.text.tertiary };
            case 'PAUSED': return { icon: 'pause-circle-outline', color: Colors.text.tertiary };
            default: return { icon: 'help-circle-outline', color: Colors.text.tertiary };
        }
    };

    const getGhStatusColor = (run: WorkflowRun) => {
        if (run.status === 'in_progress') return '#60a5fa';
        if (run.conclusion === 'success') return '#4ade80';
        if (run.conclusion === 'failure') return '#f87171';
        return Colors.text.tertiary;
    };

    const statusObj = getStatusIcon(session.state);
    const webUrl = session.url;
    const prUrl = session.outputs?.find(o => o.pullRequest)?.pullRequest?.url;

    const stripeColors: string[] = [];
    const stripeLocations: number[] = [];
    if (prInactive) {
        const step = 0.02;
        for (let i = 0; i < 200; i++) {
            const isColor = i % 2 === 1;
            const c = isColor ? 'rgba(148, 163, 184, 0.12)' : Colors.transparent;
            stripeColors.push(c, c);
            stripeLocations.push(i * step, (i + 1) * step);
        }
    }

    const menuActions = [
        {
            label: "Delete Session",
            icon: "trash-outline",
            color: "#f87171",
            onPress: handleDelete,
            disabled: !onDelete || !(session.state === 'COMPLETED' || session.state === 'FAILED' || prInactive)
        }
    ];

    return (
        <Card
            className={`mb-1 ${prInactive ? 'opacity-50' : ''}`}
            padding="p-3"
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
                <View className="flex-row items-center flex-1">
                    <TouchableOpacity onPress={() => Linking.openURL(ghRun?.html_url || webUrl)}>
                        <Animated.View style={{ transform: [{ rotate: spin }] }}>
                            <Ionicons name={statusObj.icon as any} size={24} color={statusObj.color} />
                        </Animated.View>
                    </TouchableOpacity>
                    <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>{session.title || session.id}</Text>
                        </View>
                        <Text className="text-text-tertiary text-xs" numberOfLines={1}>
                            {dayjs(session.createTime).fromNow()} • {session.state}
                        </Text>
                    </View>
                </View>
                <View className="flex-col items-center gap-1">
                    {ghRun && (
                        <MetadataChip
                            label={ghRun.status}
                            icon={ghRun.conclusion === 'success' ? "logo-github" : "alert-circle"}
                            variant="outline"
                            color={getGhStatusColor(ghRun)}
                            size="sm"
                            rounding="sm"
                        />
                    )}
                </View>
            </View>

            <View className="flex-row gap-1">
                <TouchableOpacity
                    onPress={() => Linking.openURL(webUrl)}
                    className="flex-1 bg-surface-highlight py-2 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="globe-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-2">Web</Text>
                </TouchableOpacity>

                {prUrl && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(prUrl)}
                        className="flex-1 bg-surface-highlight py-2 rounded-lg flex-row items-center justify-center"
                    >
                        <Ionicons name="git-pull-request-outline" size={14} color="white" />
                        <Text className="text-white text-xs font-semibold ml-2">PR #{prNumber}</Text>
                    </TouchableOpacity>
                )}

                {prNumber && (
                    <TouchableOpacity
                        onPress={(!isMerged && !isClosed && mergeable !== false) ? handleMerge : undefined}
                        disabled={isMerging || isMerged || isClosed || mergeable === false}
                        className={`flex-1 py-2 rounded-lg flex-row items-center justify-center ${isMerged ? 'bg-purple-500' :
                            isClosed ? 'bg-surface-highlight' :
                                mergeable === false ? 'bg-surface-highlight border border-error/50' :
                                    'bg-success'
                            }`}
                    >
                        {isMerging ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons
                                    name={isMerged ? "git-merge" : isClosed ? "close-circle" : mergeable === false ? "alert-circle-outline" : "git-merge-outline"}
                                    size={14}
                                    color={mergeable === false ? "#f87171" : "white"}
                                />
                                <Text className={`text-xs font-semibold ml-2 ${mergeable === false ? 'text-error' : 'text-white'}`}>
                                    {isMerged ? "Merged" : isClosed ? "Closed" : mergeable === false ? "Conflict" : "Merge"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => setMessageVisible(true)}
                    className="flex-1 bg-surface-highlight py-2 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="chatbox-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-2">Msg</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    className="bg-surface-highlight py-2 px-3 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="ellipsis-horizontal" size={16} color="white" />
                </TouchableOpacity>
            </View>

            {ghRun && ghToken && owner && repo && (
                <WorkflowRunItem
                    run={ghRun}
                    token={ghToken}
                    owner={owner}
                    repo={repo}
                    refreshTrigger={refreshTrigger}
                    embedded={true}
                    initialExpanded={false}
                />
            )}

            <SessionActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                actions={menuActions}
            />

            <MessageDialog
                visible={messageVisible}
                onClose={() => setMessageVisible(false)}
                onSend={handleSendMessage}
                sending={sendingMessage}
                title="Send Message to Session"
            />
        </Card>
    );
}

function MasterBranchSection({ runs, token, owner, repo, refreshTrigger }: { runs: WorkflowRun[], token: string, owner: string, repo: string, refreshTrigger?: number }) {
    const [expanded, setExpanded] = useState(false);

    if (!runs || runs.length === 0) return null;

    const runningCount = runs.filter(r => r.status === 'in_progress' || r.status === 'queued').length;

    return (
        <Card className="mb-4" padding="p-0">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="flex-row items-center justify-between p-3"
            >
                <View className="flex-row items-center">
                    <Ionicons name="git-branch" size={20} color={Colors.text.tertiary} />
                    <Text className="text-white font-bold text-base ml-2">Master Branch</Text>
                    {runningCount > 0 && (
                        <View className="ml-2">
                            <MetadataChip
                                label={`${runningCount} RUNNING`}
                                variant="outline"
                                color={Colors.primary}
                                size="sm"
                                rounding="sm"
                            />
                        </View>
                    )}
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>

            {expanded && (
                <View className="px-3 pb-3">
                    {runs.map(run => (
                        <WorkflowRunItem
                            key={run.id}
                            run={run}
                            token={token}
                            owner={owner}
                            repo={repo}
                            refreshTrigger={refreshTrigger}
                            embedded={true}
                            compact={true}
                        />
                    ))}
                </View>
            )}
        </Card>
    );
}

export default function JulesScreen() {
    const insets = useSafeAreaInsets();
    const { julesApiKey, setJulesApiKey, julesOwner, setJulesOwner, julesRepo, setJulesRepo, julesGoogleApiKey, githubClientId, githubClientSecret } = useSettingsStore();
    const [masterRuns, setMasterRuns] = useState<WorkflowRun[]>([]);
    const [allRuns, setAllRuns] = useState<WorkflowRun[]>([]);
    const [julesSessions, setJulesSessions] = useState<JulesSession[]>([]);
    const [sessionsWithRuns, setSessionsWithRuns] = useState<{ session: JulesSession, matchedRun: WorkflowRun | null }[]>([]);
    const [prStates, setPrStates] = useState<Record<string, { merged: boolean, state: string }>>({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showRepoSelector, setShowRepoSelector] = useState(false);
    const [defaultBranch, setDefaultBranch] = useState('main');

    const { setFab, clearFab } = useUIStore();

    useFocusEffect(
        useCallback(() => {
            if (julesGoogleApiKey) {
                setFab({
                    visible: true,
                    icon: 'add',
                    onPress: () => Linking.openURL('https://jules.google.com/session'),
                    color: '#4f46e5',
                    iconColor: 'white'
                });
            } else {
                clearFab();
            }

            return () => clearFab();
        }, [julesGoogleApiKey])
    );

    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId: githubClientId || 'placeholder',
            scopes: ['repo', 'read:user', 'workflow'],
            redirectUri: makeRedirectUri({
                scheme: 'com.aiinbox.mobile'
            }),
        },
        {
            authorizationEndpoint: 'https://github.com/login/oauth/authorize',
            tokenEndpoint: 'https://github.com/login/oauth/access_token',
            revocationEndpoint: 'https://github.com/settings/connections/applications/' + (githubClientId || ''),
        }
    );

    const [lastExchangedCode, setLastExchangedCode] = useState<string | null>(null);

    useEffect(() => {
        if (response?.type === 'success') {
            const { code } = response.params;
            if (code && githubClientId && githubClientSecret && code !== lastExchangedCode) {
                setLoading(true);
                setLastExchangedCode(code);
                exchangeGithubToken(githubClientId, githubClientSecret, code, makeRedirectUri({ scheme: 'com.aiinbox.mobile' }), request?.codeVerifier || undefined)
                    .then(async token => {
                        setJulesApiKey(token);
                        try {
                            const user = await fetchGithubUser(token);
                            if (user && user.login) {
                                setJulesOwner(user.login);
                            }
                        } catch (e) {
                            console.error("Failed to fetch user details after login", e);
                        }
                        Toast.show({
                            type: 'success',
                            text1: 'Logged in with GitHub!',
                        });
                        setShowRepoSelector(true);
                    })
                    .catch(err => {
                        console.error("OAuth exchange error:", err);
                        showError("Login Failed", err.message);
                        setLastExchangedCode(null);
                    })
                    .finally(() => setLoading(false));
            }
        }
    }, [response]);

    const loginWithGithub = () => {
        if (!githubClientId || !githubClientSecret) {
            showAlert("Configuration Missing", "Please configure GitHub Client ID and Secret in Settings.");
            return;
        }
        promptAsync();
    };

    const loadData = useCallback(async () => {
        setError(null);
        try {
            // 1. Fetch Sessions
            let sessions: JulesSession[] = [];
            if (julesGoogleApiKey) {
                sessions = await fetchJulesSessions(julesGoogleApiKey, 10);
                setJulesSessions(sessions);
            }

            // 2. Identify Repos to fetch runs from
            const reposToFetch = new Map<string, { owner: string, repo: string }>();

            // Add current selected repo
            if (julesApiKey && julesOwner && julesRepo) {
                reposToFetch.set(`${julesOwner}/${julesRepo}`, { owner: julesOwner, repo: julesRepo });

                // Also get default branch for current repo
                try {
                    const repoDetails = await fetchGithubRepoDetails(julesApiKey, julesOwner, julesRepo);
                    setDefaultBranch(repoDetails.default_branch || 'main');
                } catch (e) {
                    console.error("Failed to fetch default branch", e);
                }
            }

            // Add repos from sessions
            sessions.forEach(s => {
                if (s.githubMetadata?.owner && s.githubMetadata?.repo) {
                    reposToFetch.set(`${s.githubMetadata.owner}/${s.githubMetadata.repo}`, {
                        owner: s.githubMetadata.owner,
                        repo: s.githubMetadata.repo
                    });
                }
            });

            // 4. Fetch PR states for sessions
            if (julesApiKey) {
                sessions.forEach(s => {
                    const m = s.githubMetadata;
                    if (m?.owner && m?.repo && m?.pullRequestNumber) {
                        const key = `${m.owner}/${m.repo}/${m.pullRequestNumber}`;
                        if (!prStates[key]) {
                            fetchPullRequest(julesApiKey, m.owner, m.repo, m.pullRequestNumber)
                                .then(pr => {
                                    setPrStates(prev => ({
                                        ...prev,
                                        [key]: { merged: pr.merged || pr.state === 'merged', state: pr.state }
                                    }));
                                })
                                .catch(err => console.error(`Failed to fetch PR state for ${key}`, err));
                        }
                    }
                });
            }

            // 3. Fetch runs for all identified repos
            if (julesApiKey) {
                const runPromises = Array.from(reposToFetch.values()).map(async ({ owner, repo }) => {
                    try {
                        // Fetch ALL recent runs (no branch filter) to enable matching
                        const runs = await fetchWorkflowRuns(julesApiKey, owner, repo, undefined, 50);
                        return runs;
                    } catch (e) {
                        console.warn(`Failed to fetch runs for ${owner}/${repo}`, e);
                        return [];
                    }
                });

                const runsArrays = await Promise.all(runPromises);
                const combinedRuns = runsArrays.flat();
                setAllRuns(combinedRuns);
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to load data");
        }
    }, [julesApiKey, julesOwner, julesRepo, julesGoogleApiKey]);

    useEffect(() => {
        setLoading(true);
        loadData().finally(() => setLoading(false));
    }, [loadData, julesApiKey]);

    // Process sessions and match runs
    useEffect(() => {
        if (julesSessions.length > 0) {
            const mapped = julesSessions.map(session => {
                let matchedRun = null;
                const metadata = session.githubMetadata;
                const prNumber = metadata?.pullRequestNumber;
                const branch = metadata?.branch;
                const sessionStartTime = new Date(session.createTime).getTime();

                // Get PR state for sorting
                const prOwner = metadata?.owner || julesOwner;
                const prRepo = metadata?.repo || julesRepo;
                const prState = (prNumber && prOwner && prRepo) ? prStates[`${prOwner}/${prRepo}/${prNumber}`] : null;

                // Refined logic: If there's a PR, use its merged/closed status. 
                // If no PR, use session COMPLETED/FAILED status.
                // This prevents COMPLETED sessions with active PRs from dropping to bottom.
                const isInactive = prNumber
                    ? (prState ? (prState.merged || prState.state === 'closed') : false)
                    : (session.state === 'COMPLETED' || session.state === 'FAILED');

                // If allRuns is empty, we can't match, so matchedRun remains null
                if (allRuns.length > 0) {
                    if (prNumber) {
                        // Priority 1: Match by PR number
                        matchedRun = allRuns.find(r =>
                            r.pull_requests && r.pull_requests.some(p => p.number === prNumber)
                        );
                    }

                    if (!matchedRun && branch) {
                        // Fallback: Match by branch name + time constraint
                        // We enforce strict branch matching to avoid showing master runs for feature sessions
                        matchedRun = allRuns.find(r =>
                            r.head_branch === branch &&
                            new Date(r.created_at).getTime() >= sessionStartTime - 60000
                        );
                    }
                }

                return { session, matchedRun };
            });

            // Sort by most recent activity (run update or session update)
            const sorted = mapped.sort((a, b) => {
                const mA = a.session.githubMetadata;
                const mB = b.session.githubMetadata;
                const prA = mA?.pullRequestNumber ? prStates[`${mA.owner}/${mA.repo}/${mA.pullRequestNumber}`] : null;
                const prB = mB?.pullRequestNumber ? prStates[`${mB.owner}/${mB.repo}/${mB.pullRequestNumber}`] : null;

                const isInactiveA = mA?.pullRequestNumber
                    ? (prA ? (prA.merged || prA.state === 'closed') : false)
                    : (a.session.state === 'COMPLETED' || a.session.state === 'FAILED');
                const isInactiveB = mB?.pullRequestNumber
                    ? (prB ? (prB.merged || prB.state === 'closed') : false)
                    : (b.session.state === 'COMPLETED' || b.session.state === 'FAILED');

                // Move inactive to bottom
                if (isInactiveA && !isInactiveB) return 1;
                if (!isInactiveA && isInactiveB) return -1;

                const timeA = a.matchedRun ? new Date(a.matchedRun.updated_at).getTime() : new Date(a.session.updateTime).getTime();
                const timeB = b.matchedRun ? new Date(b.matchedRun.updated_at).getTime() : new Date(b.session.updateTime).getTime();
                return timeB - timeA;
            });

            setSessionsWithRuns(sorted as { session: JulesSession, matchedRun: WorkflowRun | null }[]);
        } else {
            setSessionsWithRuns([]);
        }

        // Filter master runs (only for current repo)
        if (allRuns.length > 0 && julesOwner && julesRepo) {
            const master = allRuns.filter(r =>
                r.head_branch === defaultBranch &&
                r.html_url.includes(`/${julesOwner}/${julesRepo}/`) // Ensure it belongs to current repo
            ).slice(0, 3);
            setMasterRuns(master);
        } else {
            setMasterRuns([]);
        }

    }, [julesSessions, allRuns, defaultBranch, julesOwner, julesRepo, prStates]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setRefreshTrigger(t => t + 1);
        loadData().finally(() => setRefreshing(false));
    }, [loadData]);

    const renderContent = () => {
        const hasGithubConfig = julesApiKey && julesOwner && julesRepo;
        const hasJulesConfig = !!julesGoogleApiKey;

        if (!hasGithubConfig && !hasJulesConfig) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="options-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">Configuration Required</Text>
                    <Text className="text-text-tertiary text-center mt-2 mb-6">
                        Please configure GitHub or Jules API in Settings.
                    </Text>
                    {!hasGithubConfig && (
                        <TouchableOpacity
                            onPress={loginWithGithub}
                            disabled={!request}
                            className="bg-primary px-8 py-3 rounded-xl flex-row items-center mb-4"
                        >
                            <Ionicons name="logo-github" size={24} color="white" />
                            <Text className="text-white font-bold ml-2">Login with GitHub</Text>
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        if (loading && masterRuns.length === 0 && sessionsWithRuns.length === 0) {
            return (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#818cf8" />
                </View>
            );
        }

        if (error) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="alert-circle-outline" size={64} color="#f87171" />
                    <Text className="text-error text-xl font-bold mt-4 text-center">Error</Text>
                    <Text className="text-text-tertiary text-center mt-2">{error}</Text>
                    <TouchableOpacity onPress={loadData} className="mt-6 bg-primary px-6 py-3 rounded-xl">
                        <Text className="text-white font-bold">Retry</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (masterRuns.length === 0 && sessionsWithRuns.length === 0) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="file-tray-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">No Activity Found</Text>
                    <TouchableOpacity onPress={loadData} className="mt-6 bg-primary px-6 py-3 rounded-xl">
                        <Text className="text-white font-bold">Refresh</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: 80 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
            >
                {/* Master Branch Section */}
                {hasGithubConfig && (
                    <MasterBranchSection
                        runs={masterRuns}
                        token={julesApiKey!}
                        owner={julesOwner!}
                        repo={julesRepo!}
                        refreshTrigger={refreshTrigger}
                    />
                )}

                {/* Jules Sessions Section */}
                {hasJulesConfig && (
                    <View>
                        {sessionsWithRuns.map(({ session, matchedRun }) => (
                            <JulesSessionItem
                                key={session.id}
                                session={session}
                                matchedRun={matchedRun}
                                ghToken={julesApiKey || undefined}
                                defaultOwner={julesOwner || undefined}
                                defaultRepo={julesRepo || undefined}
                                onDelete={async () => {
                                    const { deleteJulesSession } = await import('../../services/jules');
                                    if (julesGoogleApiKey) {
                                        setJulesSessions(prev => prev.filter(s => s.name !== session.name));
                                        try {
                                            await deleteJulesSession(julesGoogleApiKey, session.name);
                                        } catch (e) {
                                            console.error(e);
                                            showError("Error", "Failed to delete session");
                                            onRefresh();
                                        }
                                    }
                                }}
                                onRefresh={onRefresh}
                                julesGoogleApiKey={julesGoogleApiKey || undefined}
                                refreshTrigger={refreshTrigger}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <Layout>
            {renderContent()}
            <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
                <IslandHeader
                    title="Jules"
                    subtitle={julesOwner && julesRepo ? `${julesOwner}/${julesRepo}` : undefined}
                    rightActions={[
                        ...(julesApiKey ? [{ icon: 'git-network-outline', onPress: () => setShowRepoSelector(true) }] : []),
                        { icon: 'refresh', onPress: onRefresh },
                    ]}
                />
            </View>
            <RepoSelector
                visible={showRepoSelector}
                onClose={() => setShowRepoSelector(false)}
                token={julesApiKey || ''}
                onSelect={(repo) => {
                    setJulesOwner(repo.owner.login);
                    setJulesRepo(repo.name);
                    setShowRepoSelector(false);
                }}
            />
        </Layout>
    );
}
