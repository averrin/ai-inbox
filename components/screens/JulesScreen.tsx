import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, ActivityIndicator, StyleSheet, Modal, FlatList, TextInput, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../ui/Layout';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Card } from '../ui/Card';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { WorkflowRun, fetchWorkflowRuns, CheckRun, fetchChecks, Artifact, fetchArtifacts, JulesSession, fetchJulesSessions, mergePullRequest, fetchPullRequest, exchangeGithubToken, fetchGithubRepos, fetchGithubUser, GithubRepo, sendMessageToSession, fetchGithubRepoDetails } from '../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigation } from '@react-navigation/native';
import { downloadAndInstallArtifact, isArtifactCached, installCachedArtifact } from '../../utils/artifactHandler';
import { artifactDeps } from '../../utils/artifactDeps';
import { watcherService } from '../../services/watcherService';

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
            <TouchableOpacity style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}} activeOpacity={1} onPress={onClose}>
                <View className="bg-slate-900 rounded-t-2xl p-4 pb-10 border-t border-slate-700">
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-slate-700 rounded-full" />
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
                            className={`flex-row items-center py-4 border-b border-slate-800 ${action.disabled ? 'opacity-50' : ''}`}
                            disabled={action.disabled}
                         >
                            <Ionicons name={action.icon as any} size={20} color={action.color || "white"} style={{marginRight: 16}} />
                            <Text className={`text-base font-medium ${action.color ? '' : 'text-white'}`} style={action.color ? {color: action.color} : {}}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={onClose} className="mt-4 py-3 bg-slate-800 rounded-xl items-center">
                        <Text className="text-white font-bold">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

function MessageDialog({ visible, onClose, onSend, sending }: { visible: boolean, onClose: () => void, onSend: (message: string) => void, sending: boolean }) {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (message.trim()) {
            onSend(message);
            setMessage('');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
             <View className="flex-1 bg-black/80 justify-center px-4">
                <View className="bg-slate-900 rounded-2xl p-4 border border-slate-700">
                    <Text className="text-white font-bold text-lg mb-4">Send Message to Session</Text>
                    <TextInput
                        className="bg-slate-800 text-white p-3 rounded-lg min-h-[100px] mb-4"
                        placeholder="Type your message..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                        autoFocus
                    />
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={onClose} className="flex-1 bg-slate-800 py-3 rounded-xl items-center" disabled={sending}>
                            <Text className="text-white font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSend} className="flex-1 bg-indigo-600 py-3 rounded-xl items-center" disabled={sending || !message.trim()}>
                            {sending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Send</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
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
                <View className="bg-slate-900 rounded-2xl max-h-[80%] overflow-hidden w-full border border-slate-700">
                    <View className="p-4 border-b border-slate-700 flex-row justify-between items-center bg-slate-800">
                        <Text className="text-white font-bold text-lg">Select Repository</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <View className="p-4 bg-slate-900">
                        <View className="bg-slate-800 rounded-lg flex-row items-center px-3 mb-2 border border-slate-700">
                             <Ionicons name="search" size={20} color="#94a3b8" />
                             <TextInput
                                className="flex-1 text-white p-3"
                                placeholder="Search repositories..."
                                placeholderTextColor="#94a3b8"
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
                            className="bg-slate-900"
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="p-4 border-b border-slate-800 flex-row items-center justify-between"
                                    onPress={() => onSelect(item)}
                                >
                                    <View className="flex-1 mr-2">
                                        <Text className="text-white font-medium text-base">{item.full_name}</Text>
                                        {item.description && <Text className="text-slate-500 text-xs" numberOfLines={1}>{item.description}</Text>}
                                    </View>
                                    {item.private && <Ionicons name="lock-closed" size={14} color="#94a3b8" />}
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

function CheckStatusItem({ check }: { check: CheckRun }) {
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
         if (check.status === 'queued') return '#94a3b8';
         if (check.status === 'in_progress') return '#60a5fa';
         if (check.conclusion === 'success') return '#4ade80';
         if (check.conclusion === 'failure') return '#f87171';
         return '#94a3b8';
    };

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(check.html_url)}
            className="flex-row items-center justify-between mb-1"
        >
            <View className="flex-row items-center flex-1">
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons
                        name={getIcon() as any}
                        size={14}
                        color={getColor()}
                    />
                </Animated.View>
                <Text className="text-slate-300 text-xs ml-2 flex-1" numberOfLines={1}>{check.name}</Text>
            </View>
            <Text className="text-slate-500 text-xs">{check.status}</Text>
        </TouchableOpacity>
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

    const spinValue = useRef(new Animated.Value(0)).current;
    const isFetchingRef = useRef(false);

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
        if (run.status === 'queued') return { color: '#94a3b8', icon: 'time-outline' };
        
        switch (run.conclusion) {
            case 'success': return { color: '#4ade80', icon: 'checkmark-circle' };
            case 'failure': return { color: '#f87171', icon: 'close-circle' };
            case 'cancelled': return { color: '#fb923c', icon: 'stop-circle-outline' };
            case 'skipped': return { color: '#94a3b8', icon: 'play-skip-forward-outline' };
            case 'timed_out': return { color: '#f87171', icon: 'timer-outline' };
            case 'action_required': return { color: '#facc15', icon: 'alert-circle-outline' };
            default: return { color: '#94a3b8', icon: 'help-circle-outline' };
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
            const c = isColor ? 'rgba(148, 163, 184, 0.12)' : 'transparent';
            stripeColors.push(c, c);
            stripeLocations.push(i * step, (i + 1) * step);
        }
    }

    return (
        <Card 
            className={`mb-1 ${prInactive ? 'opacity-50' : ''}`} 
            padding="p-3"
            style={{ overflow: 'hidden', marginTop: embedded ? 8 : undefined }}
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
                        <Text className="text-slate-400 text-xs">
                            {dayjs(run.created_at).fromNow()} • {run.head_branch}
                        </Text>
                    </View>
                </TouchableOpacity>

                <View className="flex-row items-center gap-2">
                    {artifacts && artifacts.length > 0 ? (
                        <TouchableOpacity
                            onPress={handleDownloadArtifact}
                            disabled={isDownloading}
                            className={`px-3 py-1.5 ${isDownloading ? 'bg-slate-600' : 'bg-slate-700'} rounded-lg flex-row items-center overflow-hidden`}
                        >
                            {isDownloading && (
                                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(progress || 0) * 100}%`, backgroundColor: '#4ade80', opacity: 0.3 }} />
                            )}
                            {isDownloading ? (
                                <ActivityIndicator size="small" color="white" style={{ transform: [{ scale: 0.7 }] }} />
                            ) : (
                                <Ionicons name={cachedArtifactPath ? "construct-outline" : "download-outline"} size={16} color="white" />
                            )}
                            <Text className="text-white text-xs font-semibold ml-1">{isDownloading ? (status || `${Math.round((progress || 0) * 100)}%`) : (cachedArtifactPath ? "Install" : "Artifact")}</Text>
                        </TouchableOpacity>
                    ) : artifactsLoading ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                    ) : (
                        <TouchableOpacity
                            onPress={fetchArtifactsData}
                            className="px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg flex-row items-center"
                        >
                            <Ionicons name="alert-circle-outline" size={14} color="#64748b" />
                            <Text className="text-slate-500 text-xs font-medium ml-1">No Artifact</Text>
                        </TouchableOpacity>
                    )}

                    {(run.status === 'in_progress' || run.status === 'queued' || isWatched) && (
                        <TouchableOpacity
                            onPress={toggleWatch}
                            className={`p-1.5 ml-1 rounded-lg ${isWatched ? 'bg-indigo-500/20' : ''}`}
                        >
                            <Ionicons name={isWatched ? "eye" : "eye-outline"} size={20} color={isWatched ? "#818cf8" : "#94a3b8"} />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={() => setExpanded(!expanded)} className="p-1">
                        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
            </View>

            {expanded && (
                <View className="mt-2 border-t border-slate-700 pt-2">
                    <View className="flex-row gap-1 mb-3">
                        {showPrButton && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(prUrl!)}
                                className="flex-1 bg-indigo-600 py-2 rounded-lg flex-row items-center justify-center"
                            >
                                <Ionicons name="git-pull-request" size={16} color="white" />
                                <Text className="text-white font-semibold ml-2">Open PR #{pr?.number}</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text className="text-slate-400 text-xs font-bold mb-2 uppercase">Checks Status</Text>
                    {checksLoading ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                    ) : checks && checks.length > 0 ? (
                        <View>
                            {checks.map(check => (
                                <CheckStatusItem key={check.id} check={check} />
                            ))}
                        </View>
                    ) : (
                        <Text className="text-slate-500 text-xs italic">No checks found or loading...</Text>
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
            Alert.alert("Success", "Pull Request merged successfully");
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to merge Pull Request");
        } finally {
            setIsMerging(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
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
            Alert.alert("Success", "Message sent to session");
        } catch (e: any) {
            console.error("Failed to send message", e);
            Alert.alert("Error", e.message || "Failed to send message");
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
            case 'QUEUED': return { icon: 'time-outline', color: '#94a3b8' };
            case 'PAUSED': return { icon: 'pause-circle-outline', color: '#94a3b8' };
            default: return { icon: 'help-circle-outline', color: '#94a3b8' };
        }
    };

    const getGhStatusColor = (run: WorkflowRun) => {
        if (run.status === 'in_progress') return '#60a5fa';
        if (run.conclusion === 'success') return '#4ade80';
        if (run.conclusion === 'failure') return '#f87171';
        return '#94a3b8';
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
            const c = isColor ? 'rgba(148, 163, 184, 0.12)' : 'transparent';
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
                        <Text className="text-slate-400 text-xs" numberOfLines={1}>
                            {dayjs(session.createTime).fromNow()} • {session.state}
                        </Text>
                    </View>
                </View>
                <View className="flex-col items-center gap-1">
                {ghRun && (
                    <View className="flex-row items-center bg-slate-800/50 px-2 py-0.5 rounded">
                        <Ionicons
                            name={ghRun.conclusion === 'success' ? "logo-github" : "alert-circle"}
                            size={12}
                            color={getGhStatusColor(ghRun)}
                        />
                        <Text className="text-[10px] text-slate-400 uppercase ml-1.5 font-medium">{ghRun.status}</Text>
                    </View>
                )}
                    </View>
            </View>

            <View className="flex-row gap-1">
                <TouchableOpacity
                    onPress={() => Linking.openURL(webUrl)}
                    className="flex-1 bg-slate-700 py-2 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="globe-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-2">Web</Text>
                </TouchableOpacity>

                {prUrl && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(prUrl)}
                        className="flex-1 bg-indigo-600 py-2 rounded-lg flex-row items-center justify-center"
                    >
                        <Ionicons name="git-pull-request-outline" size={14} color="white" />
                        <Text className="text-white text-xs font-semibold ml-2">PR #{prNumber}</Text>
                    </TouchableOpacity>
                )}

                {prNumber && (
                    <TouchableOpacity
                        onPress={(!isMerged && !isClosed && mergeable !== false) ? handleMerge : undefined}
                        disabled={isMerging || isMerged || isClosed || mergeable === false}
                        className={`flex-1 py-2 rounded-lg flex-row items-center justify-center ${
                            isMerged ? 'bg-purple-600/50' :
                            isClosed ? 'bg-slate-600/50' :
                            mergeable === false ? 'bg-red-900/50 border border-red-500/50' :
                            'bg-green-600'
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
                                <Text className={`text-xs font-semibold ml-2 ${mergeable === false ? 'text-red-400' : 'text-white'}`}>
                                    {isMerged ? "Merged" : isClosed ? "Closed" : mergeable === false ? "Conflict" : "Merge"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => setMessageVisible(true)}
                    className="flex-1 bg-slate-700 py-2 rounded-lg flex-row items-center justify-center"
                >
                    <Ionicons name="chatbox-outline" size={14} color="white" />
                    <Text className="text-white text-xs font-semibold ml-2">Msg</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    className="bg-slate-700 py-2 px-3 rounded-lg flex-row items-center justify-center"
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
            />
        </Card>
    );
}

function MasterBranchSection({ runs, token, owner, repo, refreshTrigger }: { runs: WorkflowRun[], token: string, owner: string, repo: string, refreshTrigger?: number }) {
    const [expanded, setExpanded] = useState(false);

    if (!runs || runs.length === 0) return null;

    const runningCount = runs.filter(r => r.status === 'in_progress' || r.status === 'queued').length;

    return (
        <View className="mb-4">
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                className="flex-row items-center justify-between bg-slate-800/50 p-3 rounded-xl mb-2 border border-slate-700"
            >
                <View className="flex-row items-center">
                    <Ionicons name="git-branch" size={20} color="#94a3b8" />
                    <Text className="text-white font-bold text-base ml-2">Master Branch</Text>
                    {runningCount > 0 && (
                        <View className="bg-blue-600/30 px-2 py-0.5 rounded ml-2 border border-blue-500/50">
                            <Text className="text-blue-400 text-xs font-bold">{runningCount} RUNNING</Text>
                        </View>
                    )}
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#94a3b8" />
            </TouchableOpacity>

            {expanded && (
                <View>
                    {runs.map(run => (
                        <WorkflowRunItem
                            key={run.id}
                            run={run}
                            token={token}
                            owner={owner}
                            repo={repo}
                            refreshTrigger={refreshTrigger}
                            compact={true}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}

export default function JulesScreen() {
    const insets = useSafeAreaInsets();
    const { julesApiKey, setJulesApiKey, julesOwner, setJulesOwner, julesRepo, setJulesRepo, julesGoogleApiKey, githubClientId, githubClientSecret } = useSettingsStore();
    const [masterRuns, setMasterRuns] = useState<WorkflowRun[]>([]);
    const [allRuns, setAllRuns] = useState<WorkflowRun[]>([]);
    const [julesSessions, setJulesSessions] = useState<JulesSession[]>([]);
    const [sessionsWithRuns, setSessionsWithRuns] = useState<{session: JulesSession, matchedRun: WorkflowRun | null}[]>([]);
    const [prStates, setPrStates] = useState<Record<string, {merged: boolean, state: string}>>({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [showRepoSelector, setShowRepoSelector] = useState(false);
    const [defaultBranch, setDefaultBranch] = useState('main');

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
                        Alert.alert("Success", "Logged in with GitHub!");
                        setShowRepoSelector(true);
                    })
                    .catch(err => {
                        console.error("OAuth exchange error:", err);
                        Alert.alert("Login Failed", err.message);
                        setLastExchangedCode(null);
                    })
                    .finally(() => setLoading(false));
            }
        }
    }, [response]);

    const loginWithGithub = () => {
        if (!githubClientId || !githubClientSecret) {
            Alert.alert("Configuration Missing", "Please configure GitHub Client ID and Secret in Settings.");
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
            const reposToFetch = new Map<string, {owner: string, repo: string}>();

            // Add current selected repo
            if (julesApiKey && julesOwner && julesRepo) {
                reposToFetch.set(`${julesOwner}/${julesRepo}`, {owner: julesOwner, repo: julesRepo});

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
                const runPromises = Array.from(reposToFetch.values()).map(async ({owner, repo}) => {
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

            setSessionsWithRuns(sorted as {session: JulesSession, matchedRun: WorkflowRun | null}[]);
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
                    <Text className="text-slate-400 text-center mt-2 mb-6">
                        Please configure GitHub or Jules API in Settings.
                    </Text>
                    {!hasGithubConfig && (
                        <TouchableOpacity
                            onPress={loginWithGithub}
                            disabled={!request}
                            className="bg-indigo-600 px-8 py-3 rounded-xl flex-row items-center mb-4"
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
                    <Text className="text-red-400 text-xl font-bold mt-4 text-center">Error</Text>
                    <Text className="text-slate-400 text-center mt-2">{error}</Text>
                    <TouchableOpacity onPress={loadData} className="mt-6 bg-indigo-600 px-6 py-3 rounded-xl">
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
                    <TouchableOpacity onPress={loadData} className="mt-6 bg-indigo-600 px-6 py-3 rounded-xl">
                        <Text className="text-white font-bold">Refresh</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: 10 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
            >
                {/* New Session Button - Placed at Top as requested */}
                {hasJulesConfig && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL('https://jules.google.com/session')}
                        className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl mb-4 flex-row items-center justify-between mx-4"
                    >
                        <View className="flex-row items-center">
                            <View className="bg-indigo-600 p-2 rounded-xl mr-3">
                                <Ionicons name="add-circle" size={20} color="white" />
                            </View>
                            <View>
                                <Text className="text-white font-bold">New Jules Session</Text>
                                <Text className="text-indigo-300 text-xs">Create a new session in web</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#818cf8" />
                    </TouchableOpacity>
                )}

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
                        {sessionsWithRuns.map(({session, matchedRun}) => (
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
                                            Alert.alert("Error", "Failed to delete session");
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
            <ScreenHeader
                title="Jules"
                subtitle={julesOwner && julesRepo ? `${julesOwner}/${julesRepo}` : undefined}
                rightActions={[
                    ...(julesApiKey ? [{ icon: 'git-network-outline', onPress: () => setShowRepoSelector(true) }] : []),
                    { icon: 'refresh', onPress: onRefresh },
                ]}
            />
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
            {renderContent()}
        </Layout>
    );
}
