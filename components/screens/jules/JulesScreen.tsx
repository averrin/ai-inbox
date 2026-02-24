import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, ActivityIndicator, FlatList } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseScreen } from '../BaseScreen';
import { Card } from '../../ui/Card';
import { useSettingsStore } from '../../../store/settings';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { WorkflowRun, fetchWorkflowRuns, JulesSession, fetchJulesSessions, exchangeGithubToken, fetchGithubRepos, fetchGithubUser, GithubRepo, fetchGithubRepoDetails, fetchPullRequest } from '../../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri, ResponseType } from 'expo-auth-session';
import { showAlert, showError } from '../../../utils/alert';
import Toast from 'react-native-toast-message';

WebBrowser.maybeCompleteAuthSession();
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { useUIStore } from '../../../store/ui';
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
