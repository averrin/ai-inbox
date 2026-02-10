import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, ActivityIndicator, StyleSheet, Modal, FlatList, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Layout } from '../ui/Layout';
import { Card } from '../ui/Card';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useCallback } from 'react';
import { WorkflowRun, fetchWorkflowRuns, CheckRun, fetchChecks, Artifact, fetchArtifacts, JulesSession, fetchJulesSessions, mergePullRequest, fetchPullRequest, sendMessageToSession, exchangeGithubToken, fetchGithubRepos, fetchGithubUser, GithubRepo } from '../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();
import relativeTime from 'dayjs/plugin/relativeTime';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';

dayjs.extend(relativeTime);

function JulesSessionItem({ session, ghToken, defaultOwner, defaultRepo, onDelete, onRefresh, julesGoogleApiKey }: { session: JulesSession, ghToken?: string, defaultOwner?: string, defaultRepo?: string, onDelete?: () => void, onRefresh?: () => void, julesGoogleApiKey?: string }) {
    const [ghRun, setGhRun] = useState<WorkflowRun | null>(null);
    const [loadingGh, setLoadingGh] = useState(false);
    const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
    const [artifactsLoading, setArtifactsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [prInactive, setPrInactive] = useState(false);
    const [mergeable, setMergeable] = useState<boolean | null>(null);

    const metadata = session.githubMetadata;
    const owner = metadata?.owner || defaultOwner;
    const repo = metadata?.repo || defaultRepo;
    const prNumber = metadata?.pullRequestNumber;
    const branch = metadata?.branch;

    useEffect(() => {
        setGhRun(null);
        setArtifacts(null);
        
        if (ghToken && owner && repo && (prNumber || branch)) {
            setLoadingGh(true);
            
            // If we have a branch but it looks like a ref, use it as fallback but don't filter Actions API by it
            const isRef = branch?.startsWith('refs/') || branch?.includes('/');
            const branchFilter = branch && !isRef ? branch : undefined;
            
            // Fetch more runs to increase chance of finding the right one if branch filter is absent
            fetchWorkflowRuns(ghToken, owner, repo, undefined, 10, branchFilter)
                .then(runs => {
                    let match = null;
                    const sessionStartTime = new Date(session.createTime).getTime();
                    
                    if (prNumber) {
                        // Priority 1: Match specifically by PR number in the pull_requests field
                        match = runs.find(r => 
                            r.pull_requests && r.pull_requests.some(p => p.number === prNumber)
                        );
                    } 
                    
                    if (!match && branch) {
                        // Match by branch name but ONLY if it was created after the session started
                        match = runs.find(r => 
                            r.head_branch === branch && 
                            new Date(r.created_at).getTime() >= sessionStartTime - 60000 // 1 minute buffer
                        );
                    }

                    setGhRun(match || null);
                    if (!match) setArtifacts(null);
                    if (match) {
                        setArtifactsLoading(true);
                        fetchArtifacts(ghToken, owner, repo, match.id)
                            .then(setArtifacts)
                            .finally(() => setArtifactsLoading(false));
                    }
                })
                .catch(err => console.error("GH fetch for session error:", err))
                .finally(() => setLoadingGh(false));
            
            if (prNumber) {
                fetchPullRequest(ghToken, owner, repo, prNumber)
                    .then(pr => {
                        setPrInactive(pr.merged || pr.state === 'merged' || pr.state === 'closed');
                        setMergeable(pr.mergeable);
                    })
                    .catch(err => console.error("Fetch PR detail error:", err));
            }
        }
    }, [ghToken, owner, repo, prNumber, branch]);

    const handleDownloadArtifact = async () => {
        if (!ghRun || !artifacts || artifacts.length === 0 || !ghToken) return;
        setIsDownloading(true);
        try {
            const artifact = artifacts[0];
            const fileUri = FileSystem.documentDirectory + `${artifact.name}.zip`;
            const downloadResumable = FileSystem.createDownloadResumable(
                artifact.archive_download_url,
                fileUri,
                { headers: { 'Authorization': `Bearer ${ghToken}` } }
            );
            const result = await downloadResumable.downloadAsync();
            if (result && result.uri && await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(result.uri);
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to download artifact");
        } finally {
            setIsDownloading(false);
        }
    };

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

    const handleResolveConflict = async () => {
        if (!julesGoogleApiKey) {
            Alert.alert("Error", "Jules API key missing");
            return;
        }

        try {
            setIsResolving(true);
            await sendMessageToSession(julesGoogleApiKey, session.name, "merge master, resolve conflicts and push");
            Alert.alert("Request Sent", "Asked Jules to resolve conflicts.");
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to send resolution request");
        } finally {
            setIsResolving(false);
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

    // Generate diagonal stripes for inactive sessions
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
                    <Ionicons name={statusObj.icon as any} size={24} color={statusObj.color} />
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
                {metadata?.repoFullName && (
                    <View className="flex-row items-center bg-slate-800/50 px-2 py-0.5 rounded">
                        <Text className="text-slate-500 text-[10px]">{metadata.repoFullName}</Text>
                    </View>
                )}
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

                {session.state === 'COMPLETED' && ghRun?.conclusion === 'success' && prNumber && !prInactive && (
                    <TouchableOpacity
                        onPress={mergeable === false ? handleResolveConflict : handleMerge}
                        disabled={isMerging || isResolving}
                        className={`flex-1 py-2 rounded-lg flex-row items-center justify-center ${mergeable === false ? 'bg-orange-600' : 'bg-green-600'}`}
                    >
                        {isMerging || isResolving ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons name={mergeable === false ? "hammer-outline" : "git-merge-outline"} size={14} color="white" />
                                <Text className="text-white text-xs font-semibold ml-2">
                                    {mergeable === false ? "Resolve" : "Merge"}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {artifacts && artifacts.length > 0 ? (
                    <TouchableOpacity
                        onPress={handleDownloadArtifact}
                        disabled={isDownloading}
                        className="flex-1 bg-slate-700 py-2 rounded-lg flex-row items-center justify-center"
                    >
                        {isDownloading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons name="download-outline" size={14} color="white" />
                                <Text className="text-white text-xs font-semibold ml-2">Artifact</Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : artifactsLoading ? (
                    <View className="flex-1 bg-slate-800/50 py-2 rounded-lg items-center justify-center">
                        <ActivityIndicator size="small" color="#94a3b8" />
                    </View>
                ) : ghRun?.conclusion === 'success' ? (
                     <View className="flex-1 bg-slate-800/50 py-2 rounded-lg items-center justify-center border border-slate-700">
                        <Text className="text-slate-500 text-[10px] italic">No Artifacts</Text>
                    </View>
                ) : null}

                {(session.state === 'COMPLETED' || session.state === 'FAILED' || prInactive) && onDelete && (
                    <TouchableOpacity
                        onPress={handleDelete}
                        className="flex-1 bg-red-600/20 border border-red-500/30 py-2 rounded-lg flex-row items-center justify-center"
                    >
                        <Ionicons name="trash-outline" size={14} color="#f87171" />
                        <Text className="text-red-400 text-xs font-semibold ml-2">Delete</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Card>
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

function SessionItem({ run, token, owner, repo, initialExpanded = false }: { run: WorkflowRun, token: string, owner: string, repo: string, initialExpanded?: boolean }) {
    const [checks, setChecks] = useState<CheckRun[] | null>(null);
    const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [checksLoading, setChecksLoading] = useState(false);
    const [artifactsLoading, setArtifactsLoading] = useState(false);
    const [expanded, setExpanded] = useState(initialExpanded);
    const [prInactive, setPrInactive] = useState(false);

    // Some runs have pull_requests populated, others don't.
    const pr = run.pull_requests && run.pull_requests.length > 0 ? run.pull_requests[0] : null;

    useEffect(() => {
        if (pr) {
            fetchPullRequest(token, owner, repo, pr.number)
                .then(prData => setPrInactive(prData.merged || prData.state === 'merged' || prData.state === 'closed'))
                .catch(err => console.error("Fetch PR detail error:", err));
        }
    }, [pr, token, owner, repo]);

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
                setArtifactsLoading(true);
                fetchArtifacts(token, owner, repo, run.id)
                    .then(setArtifacts)
                    .catch(err => console.error("Artifacts fetch error:", err))
                    .finally(() => setArtifactsLoading(false));
            }
        }
    }, [expanded, run.head_sha, run.id, token, owner, repo, checks, artifacts, checksLoading, artifactsLoading]);

    const handleDownloadArtifact = async () => {
        if (!artifacts || artifacts.length === 0) return;
        setIsDownloading(true);
        try {
            // Sort by creation date descending
            const sortedArtifacts = [...artifacts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const artifact = sortedArtifacts[0];

            const fileUri = FileSystem.documentDirectory + `${artifact.name}.zip`;

            const downloadResumable = FileSystem.createDownloadResumable(
                artifact.archive_download_url,
                fileUri,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const result = await downloadResumable.downloadAsync();
            if (result && result.uri) {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(result.uri);
                } else {
                    Alert.alert("Success", "Artifact downloaded to: " + result.uri);
                }
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to download artifact");
        } finally {
            setIsDownloading(false);
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

    // Construct PR URL if available or try to guess
    const prUrl = pr ? `https://github.com/${owner}/${repo}/pull/${pr.number}` : null;

    // Generate diagonal stripes for inactive sessions
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
            <TouchableOpacity onPress={() => setExpanded(!expanded)} className="flex-row items-center justify-between mb-1">
                <View className="flex-row items-center flex-1">
                    <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
                    <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-white font-bold text-base flex-1" numberOfLines={1}>{run.name}</Text>
                            <Text className="text-slate-500 text-[10px] ml-2 px-1.5 py-0.5 bg-slate-800 rounded">{owner}/{repo}</Text>
                        </View>
                        <Text className="text-slate-400 text-xs">
                            {dayjs(run.created_at).fromNow()} • {run.head_branch}
                        </Text>
                    </View>
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color="#94a3b8" />
            </TouchableOpacity>

            {expanded && (
                <View className="mt-2 border-t border-slate-700 pt-2">
                    {/* Actions Row */}
                    <View className="flex-row gap-1 mb-3">
                        {prUrl ? (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(prUrl)}
                                className="flex-1 bg-indigo-600 py-2 rounded-lg flex-row items-center justify-center"
                            >
                                <Ionicons name="git-pull-request" size={16} color="white" />
                                <Text className="text-white font-semibold ml-2">Open PR #{pr?.number}</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(run.html_url)}
                                className="flex-1 bg-slate-700 py-2 rounded-lg flex-row items-center justify-center"
                            >
                                <Ionicons name="logo-github" size={16} color="white" />
                                <Text className="text-white font-semibold ml-2">Open Run</Text>
                            </TouchableOpacity>
                        )}

                        {artifacts && artifacts.length > 0 ? (
                            <TouchableOpacity
                                onPress={handleDownloadArtifact}
                                disabled={isDownloading}
                                className={`flex-1 ${isDownloading ? 'bg-slate-600' : 'bg-slate-700'} py-2 rounded-lg flex-row items-center justify-center`}
                            >
                                {isDownloading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="download-outline" size={16} color="white" />
                                        <Text className="text-white font-semibold ml-2">Artifact</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : artifactsLoading ? (
                             <View className="flex-1 bg-slate-800/50 py-2 rounded-lg items-center justify-center">
                                <ActivityIndicator size="small" color="#94a3b8" />
                             </View>
                        ) : (
                            <View className="flex-1 bg-slate-800/50 py-2 rounded-lg items-center justify-center border border-slate-700">
                                <Text className="text-slate-500 text-[10px] italic">No Artifacts</Text>
                            </View>
                        )}
                    </View>

                    {/* Checks List */}
                    <Text className="text-slate-400 text-xs font-bold mb-2 uppercase">Checks Status</Text>
                    {checksLoading ? (
                        <ActivityIndicator size="small" color="#94a3b8" />
                    ) : checks && checks.length > 0 ? (
                        <View>
                            {checks.map(check => (
                                <View key={check.id} className="flex-row items-center justify-between mb-1">
                                    <View className="flex-row items-center flex-1">
                                        <Ionicons
                                            name={check.conclusion === 'success' ? 'checkmark' : check.conclusion === 'failure' ? 'close' : 'ellipse'}
                                            size={14}
                                            color={check.conclusion === 'success' ? '#4ade80' : check.conclusion === 'failure' ? '#f87171' : '#94a3b8'}
                                        />
                                        <Text className="text-slate-300 text-xs ml-2 flex-1" numberOfLines={1}>{check.name}</Text>
                                    </View>
                                    <Text className="text-slate-500 text-xs">{check.status}</Text>
                                </View>
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

export default function JulesScreen() {
    const { julesApiKey, setJulesApiKey, julesOwner, setJulesOwner, julesRepo, setJulesRepo, julesWorkflow, julesGoogleApiKey, julesNotificationsEnabled, githubClientId, githubClientSecret } = useSettingsStore();
    const [mode, setMode] = useState<'jules' | 'github'>('jules');
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [julesSessions, setJulesSessions] = useState<JulesSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showRepoSelector, setShowRepoSelector] = useState(false);

    const [request, response, promptAsync] = useAuthRequest(
        {
            clientId: githubClientId || 'placeholder',
            scopes: ['repo', 'read:user', 'workflow'],
            redirectUri: makeRedirectUri({
                scheme: 'aiinbox'
            }),
        },
        {
            authorizationEndpoint: 'https://github.com/login/oauth/authorize',
            tokenEndpoint: 'https://github.com/login/oauth/access_token',
            revocationEndpoint: 'https://github.com/settings/connections/applications/' + (githubClientId || ''),
        }
    );

    useEffect(() => {
        if (response?.type === 'success') {
            const { code } = response.params;
            if (code && githubClientId && githubClientSecret) {
                setLoading(true);
                exchangeGithubToken(githubClientId, githubClientSecret, code, makeRedirectUri({ scheme: 'aiinbox' }))
                    .then(async token => {
                        setJulesApiKey(token);

                        // Auto-fetch user details to set owner default
                        try {
                            const user = await fetchGithubUser(token);
                            if (user && user.login) {
                                setJulesOwner(user.login);
                            }
                        } catch (e) {
                            console.error("Failed to fetch user details after login", e);
                        }

                        Alert.alert("Success", "Logged in with GitHub!");
                        setShowRepoSelector(true); // Open repo selector
                    })
                    .catch(err => {
                        console.error(err);
                        Alert.alert("Login Failed", err.message);
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
            if (mode === 'github') {
                if (julesApiKey && julesOwner && julesRepo) {
                    const data = await fetchWorkflowRuns(julesApiKey, julesOwner, julesRepo, julesWorkflow || undefined, 25);
                    setRuns(data);
                }
            } else {
                if (julesGoogleApiKey) {
                    const data = await fetchJulesSessions(julesGoogleApiKey, 25);
                    setJulesSessions(data);
                }
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to load data");
        }
    }, [mode, julesApiKey, julesOwner, julesRepo, julesWorkflow, julesGoogleApiKey]);

    useEffect(() => {
        setLoading(true);
        loadData().finally(() => setLoading(false));
    }, [loadData, mode, julesApiKey]); // Added julesApiKey to deps so it reloads after login

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData().finally(() => setRefreshing(false));
    }, [loadData]);

    const renderContent = () => {
        const hasGithubConfig = julesApiKey && julesOwner && julesRepo;
        const hasJulesConfig = !!julesGoogleApiKey;

        if (mode === 'github' && !hasGithubConfig) {
            if (!julesApiKey) {
                return (
                    <View className="flex-1 justify-center items-center px-6">
                        <Ionicons name="logo-github" size={64} color="#475569" />
                        <Text className="text-white text-xl font-bold mt-4 text-center">GitHub Integration</Text>
                        <Text className="text-slate-400 text-center mt-2 mb-6">
                            Login with GitHub to view your workflow runs and artifacts.
                        </Text>
                        <TouchableOpacity
                            onPress={loginWithGithub}
                            disabled={!request}
                            className="bg-indigo-600 px-8 py-3 rounded-xl flex-row items-center"
                        >
                            <Ionicons name="logo-github" size={24} color="white" />
                            <Text className="text-white font-bold ml-2">Login with GitHub</Text>
                        </TouchableOpacity>
                        {(!githubClientId || !githubClientSecret) && (
                            <Text className="text-slate-500 text-xs mt-4 text-center">
                                (Requires Client ID/Secret in Settings)
                            </Text>
                        )}
                    </View>
                );
            }

            // Token exists but repo missing
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="git-branch-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">Select Repository</Text>
                    <Text className="text-slate-400 text-center mt-2 mb-6">
                        Choose a repository to view workflows.
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowRepoSelector(true)}
                        className="bg-indigo-600 px-8 py-3 rounded-xl"
                    >
                        <Text className="text-white font-bold">Select Repository</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (mode === 'jules' && !hasJulesConfig) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="planet-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">Setup Jules API</Text>
                    <Text className="text-slate-400 text-center mt-2 mb-6">
                        Configure your Google Jules API Key in Settings to see sessions.
                    </Text>
                </View>
            );
        }

        if (loading && (mode === 'github' ? runs.length === 0 : julesSessions.length === 0)) {
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

        const items = mode === 'github' ? runs : julesSessions;

        if (items.length === 0) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="file-tray-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">No Activity Found</Text>
                    <Text className="text-slate-400 text-center mt-2">
                        No recent {mode === 'github' ? 'workflow runs' : 'sessions'} found.
                    </Text>
                    <TouchableOpacity onPress={loadData} className="mt-6 bg-indigo-600 px-6 py-3 rounded-xl">
                        <Text className="text-white font-bold">Refresh</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
            >
                {mode === 'github' ? (
                    runs.map((run, index) => (
                        <SessionItem
                            key={run.id}
                            run={run}
                            token={julesApiKey!}
                            owner={julesOwner!}
                            repo={julesRepo!}
                            initialExpanded={index === 0}
                        />
                    ))
                ) : (
                    <>
                    <TouchableOpacity 
                        onPress={() => Linking.openURL('https://jules.google.com/session')}
                        className="bg-indigo-600/20 border border-indigo-500/30 p-4 rounded-2xl mb-4 flex-row items-center justify-between"
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

                    {julesSessions.map(session => (
                        <JulesSessionItem
                            key={session.id}
                            session={session}
                            ghToken={julesApiKey || undefined}
                            defaultOwner={julesOwner || undefined}
                            defaultRepo={julesRepo || undefined}
                            onDelete={async () => {
                                const { deleteJulesSession } = await import('../../services/jules');
                                if (julesGoogleApiKey) {
                                    await deleteJulesSession(julesGoogleApiKey, session.name);
                                    onRefresh();
                                }
                            }}
                            onRefresh={onRefresh}
                            julesGoogleApiKey={julesGoogleApiKey || undefined}
                        />
                    ))
                    }</>
                )}
            </ScrollView>
        );
    };

    return (
        <Layout>
            <View className="px-4 pt-4 pb-2 border-b border-slate-800">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center">
                        <Text className="text-2xl font-bold text-white mr-2">Jules Activities</Text>
                        {julesNotificationsEnabled && (
                            <View className="bg-green-600/20 px-2 py-0.5 rounded-full border border-green-500/30 flex-row items-center">
                                <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5" />
                                <Text className="text-green-400 text-[10px] font-bold uppercase tracking-wider">Live Monitoring</Text>
                            </View>
                        )}
                    </View>
                    <View className="flex-row items-center">
                        {mode === 'github' && julesApiKey && (
                            <TouchableOpacity onPress={() => setShowRepoSelector(true)} className="p-2 mr-1">
                                <Ionicons name="git-network-outline" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={onRefresh} className="p-2">
                            <Ionicons name="refresh" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
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
                
                <View className="flex-row bg-slate-800 rounded-lg p-1">
                    <TouchableOpacity 
                        onPress={() => setMode('jules')}
                        className={`flex-1 py-2 rounded-md items-center ${mode === 'jules' ? 'bg-indigo-600' : ''}`}
                    >
                        <Text className={`font-bold ${mode === 'jules' ? 'text-white' : 'text-slate-400'}`}>Jules</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => setMode('github')}
                        className={`flex-1 py-2 rounded-md items-center ${mode === 'github' ? 'bg-indigo-600' : ''}`}
                    >
                        <Text className={`font-bold ${mode === 'github' ? 'text-white' : 'text-slate-400'}`}>GitHub Workflows</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {renderContent()}
        </Layout>
    );
}
