import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseScreen } from '../BaseScreen';
import { useSettingsStore } from '../../../store/settings';
import { useEffect, useState, useCallback } from 'react';
import { WorkflowRun, exchangeGithubToken, fetchGithubUser } from '../../../services/jules';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import { showAlert, showError } from '../../../utils/alert';
import Toast from 'react-native-toast-message';

WebBrowser.maybeCompleteAuthSession();
import relativeTime from 'dayjs/plugin/relativeTime';
import dayjs from 'dayjs';

import { useFab } from '../../../hooks/useFab';

dayjs.extend(relativeTime);

import { JulesSessionItem } from './JulesSessionItem';
import { MasterBranchSection } from './MasterBranchSection';
import { dashboardService, DashboardData, DashboardJointSession, dashboardRunToWorkflowRun } from '../../../services/dashboardService';

export default function JulesScreen() {
    const insets = useSafeAreaInsets();
    const { julesApiKey, setJulesApiKey, julesOwner, setJulesOwner, julesRepo, setJulesRepo, julesGoogleApiKey, githubClientId, githubClientSecret } = useSettingsStore();

    const [dashboardData, setDashboardData] = useState<DashboardData | null>(dashboardService.getData());
    const [refreshing, setRefreshing] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Subscribe to real-time dashboard data from Firestore
    useEffect(() => {
        const unsub = dashboardService.addListener((data) => {
            setDashboardData(data);
        });
        return unsub;
    }, []);

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
                    })
                    .catch(err => {
                        console.error("OAuth exchange error:", err);
                        showError("Login Failed", err.message);
                        setLastExchangedCode(null);
                    });
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

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setRefreshTrigger(t => t + 1);
        dashboardService.triggerRefresh()
            .catch(err => console.error('[JulesScreen] Refresh trigger failed:', err))
            .finally(() => setRefreshing(false));
    }, []);

    // Derive display data from dashboardData
    const masterRuns = dashboardData?.masterRuns ?? [];

    const sessionsWithRuns: { session: DashboardJointSession['session'], matchedRun: WorkflowRun | null, dashRun: DashboardJointSession['run'] }[] =
        (dashboardData?.jointSessions ?? []).map(js => ({
            session: js.session,
            matchedRun: js.run ? dashboardRunToWorkflowRun(js.run) : null,
            dashRun: js.run,
        }));

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

        if (!dashboardData) {
            return (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#818cf8" />
                    <Text className="text-text-tertiary text-sm mt-3">Waiting for dashboard data...</Text>
                </View>
            );
        }

        if (masterRuns.length === 0 && sessionsWithRuns.length === 0) {
            return (
                <View className="flex-1 justify-center items-center px-6">
                    <Ionicons name="file-tray-outline" size={64} color="#475569" />
                    <Text className="text-white text-xl font-bold mt-4 text-center">No Activity Found</Text>
                    <TouchableOpacity onPress={onRefresh} className="mt-6 bg-primary px-6 py-3 rounded-xl">
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
                {hasGithubConfig && masterRuns.length > 0 && (
                    <MasterBranchSection
                        runs={masterRuns}
                        token={julesApiKey!}
                        owner={julesOwner!}
                        repo={julesRepo!}
                        refreshTrigger={refreshTrigger}
                    />
                )}

                {/* Jules Sessions Section */}
                {sessionsWithRuns.length > 0 && (
                    <View>
                        {sessionsWithRuns.map(({ session, matchedRun, dashRun }) => (
                            <JulesSessionItem
                                key={session.id}
                                session={session as any}
                                matchedRun={matchedRun}
                                artifactUrl={dashRun?.artifactUrl ?? null}
                                ghToken={julesApiKey || undefined}
                                defaultOwner={julesOwner || undefined}
                                defaultRepo={julesRepo || undefined}
                                initialPrMerged={dashRun?.prMerged ?? null}
                                initialPrState={dashRun?.prState ?? null}
                                onDelete={async () => {
                                    const { deleteJulesSession } = await import('../../../services/jules');
                                    if (julesGoogleApiKey) {
                                        try {
                                            await deleteJulesSession(julesGoogleApiKey, session.name);
                                            dashboardService.triggerRefresh().catch(console.error);
                                        } catch (e) {
                                            console.error(e);
                                            showError("Error", "Failed to delete session");
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
            title="Development"
            rightActions={[
                { icon: 'refresh', onPress: onRefresh },
            ]}
        >
            {renderContent()}
        </BaseScreen>
    );
}
