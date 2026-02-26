import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, ActivityIndicator, FlatList } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseScreen } from '../BaseScreen';
import { Card } from '../../ui/Card';
import { useSettingsStore } from '../../../store/settings';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { WorkflowRun, fetchWorkflowRuns, JulesSession, fetchJulesSessions, exchangeGithubToken, fetchGithubRepos, fetchGithubUser, GithubRepo, fetchGithubRepoDetails, fetchPullRequest } from '../../../services/jules';
import { subscribeToJulesSessions, subscribeToWatchedRuns } from '../../../services/julesFirebase';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import { showAlert, showError } from '../../../utils/alert';
import Toast from 'react-native-toast-message';

WebBrowser.maybeCompleteAuthSession();
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigation } from '@react-navigation/native';

import { useFab } from '../../../hooks/useFab';
import { Colors } from '../../ui/design-tokens';
import { MetadataChip } from '../../ui/MetadataChip';

dayjs.extend(relativeTime);

import { RepoSelector } from './RepoSelector';
import { JulesSessionItem } from './JulesSessionItem';
import { MasterBranchSection } from './MasterBranchSection';

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

    const handleFabPress = useCallback(() => {
        Linking.openURL('https://jules.google.com/session');
    }, []);

    useFab({
        visible: !!julesGoogleApiKey,
        icon: 'add',
        onPress: handleFabPress,
        color: '#4f46e5',
        iconColor: 'white'
    });

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

    // Replace loadData loop with Firebase Subscriptions
    useEffect(() => {
        const unsubSessions = subscribeToJulesSessions((sessions) => {
            setJulesSessions(sessions);
        });

        const unsubRuns = subscribeToWatchedRuns((runs) => {
            setAllRuns(runs);
        });

        return () => {
            unsubSessions();
            unsubRuns();
        };
    }, []);

    // Manual refresh fallback
    const loadData = useCallback(async () => {
        setError(null);
        try {
            // Fallback: Fetch directly if manual refresh is needed, though Firestore should be live
            // We can just trigger a re-render or let the backend do its job.
            // For now, let's keep the manual fetch logic as a "force sync" mechanism
            // or just rely on the subscription updates.

            // If we want to force refresh, we might need to call an endpoint,
            // but for now, let's assume the user just wants to see if new data arrived.
            // Since we use Firestore, local state is always up to date with DB.
            // Maybe we can fetch default branch here if missing.

            if (julesApiKey && julesOwner && julesRepo) {
                 try {
                    const repoDetails = await fetchGithubRepoDetails(julesApiKey, julesOwner, julesRepo);
                    setDefaultBranch(repoDetails.default_branch || 'main');
                } catch (e) {
                    console.error("Failed to fetch default branch", e);
                }
            }

            // Also fetch PR states if needed
             if (julesApiKey && julesSessions.length > 0) {
                julesSessions.forEach(s => {
                    const m = s.githubMetadata;
                    if (m?.owner && m?.repo && m?.pullRequestNumber) {
                        const key = `${m.owner}/${m.repo}/${m.pullRequestNumber}`;
                        if (!prStates[key]) {
                            fetchPullRequest(julesApiKey, m.owner, m.repo, m.pullRequestNumber)
                                .then((pr: any) => {
                                    setPrStates(prev => ({
                                        ...prev,
                                        [key]: { merged: pr.merged || pr.state === 'merged', state: pr.state }
                                    }));
                                })
                                .catch((err: any) => console.error(`Failed to fetch PR state for ${key}`, err));
                        }
                    }
                });
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to load data");
        }
    }, [julesApiKey, julesOwner, julesRepo, julesGoogleApiKey, julesSessions, prStates]);

    useEffect(() => {
        // Initial load of auxiliary data
        loadData();
    }, [loadData]);

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
                        // Note: Backend might not return pull_requests array fully populated in WatchedRunData
                        // We might need to rely on head_branch if PR info is missing
                        matchedRun = allRuns.find(r =>
                            (r.pull_requests && r.pull_requests.some(p => p.number === prNumber)) ||
                            (branch && r.head_branch === branch) // Fallback to branch match if PR info missing
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
                // r.html_url.includes(`/${julesOwner}/${julesRepo}/`) // html_url check might be brittle if partial data
                // Better check if we have owner/repo fields if added to interface, or rely on context
                (r as any).owner === julesOwner && (r as any).repo === julesRepo
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
            // Still show empty state but refreshing works via pull-to-refresh
            return (
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
                >
                    <View className="flex-1 justify-center items-center px-6">
                        <Ionicons name="file-tray-outline" size={64} color="#475569" />
                        <Text className="text-white text-xl font-bold mt-4 text-center">No Activity Found</Text>
                        <Text className="text-text-tertiary mt-2 text-center">Data is synced from the backend.</Text>
                    </View>
                </ScrollView>
            );
        }

        return (
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: insets.bottom + 80, paddingTop: 60 }}
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
                                    const { deleteJulesSession } = await import('../../../services/jules');
                                    if (julesGoogleApiKey) {
                                        // setJulesSessions(prev => prev.filter(s => s.name !== session.name)); // Don't optimistically update here if Firestore is live
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
        <BaseScreen
            title="Jules"
            subtitle={julesOwner && julesRepo ? `${julesOwner}/${julesRepo}` : undefined}
            rightActions={[
                ...(julesApiKey ? [{ icon: 'git-network-outline', onPress: () => setShowRepoSelector(true) }] : []),
                { icon: 'refresh', onPress: onRefresh },
            ]}
        >
            {renderContent()}
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
        </BaseScreen>
    );
}
