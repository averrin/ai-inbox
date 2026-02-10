import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { Layout } from '../ui/Layout';
import { Card } from '../ui/Card';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useCallback } from 'react';
import { WorkflowRun, fetchWorkflowRuns, CheckRun, fetchChecks, Artifact, fetchArtifacts, JulesSession, fetchJulesSessions, mergePullRequest, fetchPullRequest } from '../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';

dayjs.extend(relativeTime);

function JulesSessionItem({ session, ghToken, defaultOwner, defaultRepo }: { session: JulesSession, ghToken?: string, defaultOwner?: string, defaultRepo?: string }) {
    const [ghRun, setGhRun] = useState<WorkflowRun | null>(null);
    const [loadingGh, setLoadingGh] = useState(false);
    const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    const [prMerged, setPrMerged] = useState(false);

    const metadata = session.githubMetadata;
    const owner = metadata?.owner || defaultOwner;
    const repo = metadata?.repo || defaultRepo;
    const prNumber = metadata?.pullRequestNumber;
    const branch = metadata?.branch;

    useEffect(() => {
        console.log(session);
        if (ghToken && owner && repo && (prNumber || branch)) {
            setLoadingGh(true);
            
            // If we have a branch but it looks like a ref, use it as fallback but don't filter Actions API by it
            const isRef = branch?.startsWith('refs/') || branch?.includes('/');
            const branchFilter = branch && !isRef ? branch : undefined;
            
            // Fetch more runs to increase chance of finding the right one if branch filter is absent
            fetchWorkflowRuns(ghToken, owner, repo, undefined, 10, branchFilter)
                .then(runs => {
                    let match = runs[0];
                    
                    if (prNumber) {
                        // Priority 1: Match specifically by PR number in the pull_requests field
                        const prMatch = runs.find(r => 
                            r.pull_requests && r.pull_requests.some(p => p.number === prNumber)
                        );
                        if (prMatch) {
                            match = prMatch;
                        } else if (branch) {
                            // Priority 2: Match by branch name if PR match failed
                            const branchMatch = runs.find(r => r.head_branch === branch);
                            if (branchMatch) match = branchMatch;
                        }
                    } else if (branch) {
                        // Match by branch name
                        const branchMatch = runs.find(r => r.head_branch === branch);
                        if (branchMatch) match = branchMatch;
                    }

                    setGhRun(match || null);
                    if (match) {
                        fetchArtifacts(ghToken, owner, repo, match.id).then(setArtifacts);
                    }
                })
                .catch(err => console.error("GH fetch for session error:", err))
                .finally(() => setLoadingGh(false));
            
            if (prNumber) {
                fetchPullRequest(ghToken, owner, repo, prNumber)
                    .then(pr => setPrMerged(pr.merged || pr.state === 'merged'))
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
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to merge Pull Request");
        } finally {
            setIsMerging(false);
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

    return (
        <Card className="mb-1" padding="p-3">
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

                {session.state === 'COMPLETED' && ghRun?.conclusion === 'success' && prNumber && !prMerged && (
                    <TouchableOpacity
                        onPress={handleMerge}
                        disabled={isMerging}
                        className="flex-1 bg-green-600 py-2 rounded-lg flex-row items-center justify-center"
                    >
                        {isMerging ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <>
                                <Ionicons name="git-merge-outline" size={14} color="white" />
                                <Text className="text-white text-xs font-semibold ml-2">Merge</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                {artifacts && artifacts.length > 0 && (
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
                )}
            </View>
        </Card>
    );
}

function SessionItem({ run, token, owner, repo }: { run: WorkflowRun, token: string, owner: string, repo: string }) {
    const [checks, setChecks] = useState<CheckRun[] | null>(null);
    const [artifacts, setArtifacts] = useState<Artifact[] | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [checksLoading, setChecksLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Some runs have pull_requests populated, others don't.
    const pr = run.pull_requests && run.pull_requests.length > 0 ? run.pull_requests[0] : null;

    useEffect(() => {
        if (expanded && !checks) {
            setChecksLoading(true);
            fetchChecks(token, owner, repo, run.head_sha)
                .then(setChecks)
                .catch(err => console.error("Checks fetch error:", err))
                .finally(() => setChecksLoading(false));

            fetchArtifacts(token, owner, repo, run.id)
                .then(setArtifacts)
                .catch(err => console.error("Artifacts fetch error:", err));
        }
    }, [expanded, run.head_sha, run.id, token, owner, repo, checks]);

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

    return (
        <Card className="mb-1" padding="p-3">
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

                        {artifacts && artifacts.length > 0 && (
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
    const { julesApiKey, julesOwner, julesRepo, julesWorkflow, julesGoogleApiKey } = useSettingsStore();
    const [mode, setMode] = useState<'jules' | 'github'>('jules');
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [julesSessions, setJulesSessions] = useState<JulesSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setError(null);
        try {
            if (mode === 'github') {
                if (julesApiKey && julesOwner && julesRepo) {
                    const data = await fetchWorkflowRuns(julesApiKey, julesOwner, julesRepo, julesWorkflow || undefined, 10);
                    setRuns(data);
                }
            } else {
                if (julesGoogleApiKey) {
                    const data = await fetchJulesSessions(julesGoogleApiKey, 10);
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
    }, [loadData, mode]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData().finally(() => setRefreshing(false));
    }, [loadData]);

    const renderContent = () => {
        const hasGithubConfig = julesApiKey && julesOwner && julesRepo;
        const hasJulesConfig = !!julesGoogleApiKey;

        if (mode === 'github' && !hasGithubConfig) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="logo-github" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">Setup GitHub Integration</Text>
                    <Text className="text-slate-400 text-center mt-2 mb-6">
                        Configure your GitHub PAT, Owner, and Repo in Settings to see workflow runs.
                    </Text>
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
                    runs.map(run => (
                        <SessionItem
                            key={run.id}
                            run={run}
                            token={julesApiKey!}
                            owner={julesOwner!}
                            repo={julesRepo!}
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
                    <Text className="text-2xl font-bold text-white">Jules Activities</Text>
                    <TouchableOpacity onPress={onRefresh} className="p-2">
                        <Ionicons name="refresh" size={24} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
                
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
