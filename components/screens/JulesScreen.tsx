import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { Layout } from '../ui/Layout';
import { Card } from '../ui/Card';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useCallback } from 'react';
import { WorkflowRun, fetchWorkflowRuns, CheckRun, fetchChecks, Artifact, fetchArtifacts } from '../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

dayjs.extend(relativeTime);

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

    const statusColor =
        run.conclusion === 'success' ? 'text-green-400' :
        run.conclusion === 'failure' ? 'text-red-400' :
        run.status === 'in_progress' ? 'text-blue-400' : 'text-slate-400';

    const iconName =
        run.conclusion === 'success' ? 'checkmark-circle' :
        run.conclusion === 'failure' ? 'close-circle' :
        run.status === 'in_progress' ? 'sync' : 'time';

    // Construct PR URL if available or try to guess
    const prUrl = pr ? `https://github.com/${owner}/${repo}/pull/${pr.number}` : null;

    return (
        <Card className="mb-4">
            <TouchableOpacity onPress={() => setExpanded(!expanded)} className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center flex-1">
                    <Ionicons name={iconName} size={24} color={run.conclusion === 'success' ? '#4ade80' : run.conclusion === 'failure' ? '#f87171' : '#60a5fa'} />
                    <View className="ml-3 flex-1">
                        <Text className="text-white font-bold text-base" numberOfLines={1}>{run.name}</Text>
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
                    <View className="flex-row gap-2 mb-3">
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
    const { julesApiKey, julesOwner, julesRepo, julesWorkflow } = useSettingsStore();
    const [runs, setRuns] = useState<WorkflowRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        if (!julesApiKey || !julesOwner || !julesRepo) {
            return;
        }

        try {
            setError(null);
            const data = await fetchWorkflowRuns(julesApiKey, julesOwner, julesRepo, julesWorkflow || undefined, 10);
            setRuns(data);
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to load sessions");
        }
    }, [julesApiKey, julesOwner, julesRepo, julesWorkflow]);

    useEffect(() => {
        if (julesApiKey && julesOwner && julesRepo) {
            setLoading(true);
            loadData().finally(() => setLoading(false));
        }
    }, [loadData, julesApiKey, julesOwner, julesRepo]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData().finally(() => setRefreshing(false));
    }, [loadData]);

    const renderContent = () => {
        if (!julesApiKey || !julesOwner || !julesRepo) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="settings-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">Setup Jules Integration</Text>
                    <Text className="text-slate-400 text-center mt-2 mb-6">
                        Please configure your GitHub API Key, Owner, and Repo in Settings to see your sessions.
                    </Text>
                </View>
            );
        }

        if (loading && runs.length === 0) {
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

        if (runs.length === 0) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="file-tray-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">No Sessions Found</Text>
                    <Text className="text-slate-400 text-center mt-2">
                        No recent workflow runs found for the configured repository.
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
                {runs.map(run => (
                    <SessionItem
                        key={run.id}
                        run={run}
                        token={julesApiKey!}
                        owner={julesOwner!}
                        repo={julesRepo!}
                    />
                ))}
            </ScrollView>
        );
    };

    return (
        <Layout>
            <View className="px-4 py-4 border-b border-slate-800 flex-row items-center justify-between">
                <Text className="text-2xl font-bold text-white">Jules Sessions</Text>
                <TouchableOpacity onPress={onRefresh} className="p-2">
                    <Ionicons name="refresh" size={24} color="#94a3b8" />
                </TouchableOpacity>
            </View>
            {renderContent()}
        </Layout>
    );
}
