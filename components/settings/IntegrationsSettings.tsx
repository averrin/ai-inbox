import { View, Text, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { CloudSyncSettings } from './CloudSyncSettings';
import { Ionicons } from '@expo/vector-icons';
import { AuthRequest } from 'expo-auth-session';

interface IntegrationsSettingsProps {
    // Gemini
    apiKey: string;
    onChangeApiKey: (text: string) => void;

    // GitHub / Jules
    githubClientId: string;
    onChangeGithubClientId: (text: string) => void;
    githubClientSecret: string;
    onChangeGithubClientSecret: (text: string) => void;
    julesGoogleApiKey: string;
    onChangeJulesGoogleApiKey: (text: string) => void;
    julesApiKey: string | null; // GitHub Personal Access Token or OAuth Token

    // Actions
    onLoginGithub: () => void;
    githubRequest: AuthRequest | null;
    isGithubConfigDirty?: boolean;
}

export function IntegrationsSettings({
    apiKey, onChangeApiKey,
    githubClientId, onChangeGithubClientId,
    githubClientSecret, onChangeGithubClientSecret,
    julesGoogleApiKey, onChangeJulesGoogleApiKey,
    julesApiKey,
    onLoginGithub, githubRequest, isGithubConfigDirty
}: IntegrationsSettingsProps) {
    const isGithubLoggedIn = !!julesApiKey;

    return (
        <View>
            <Card>
                <View className="mb-4">
                    <Text className="text-indigo-200 mb-2 font-semibold">Gemini AI</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Configure your Google Gemini API key for AI features.
                    </Text>
                    <Input
                        label="API Key"
                        value={apiKey}
                        onChangeText={onChangeApiKey}
                        placeholder="AIza..."
                    />
                </View>
            </Card>

            <CloudSyncSettings />

            <Card>
                <View className="mb-4">
                    <Text className="text-indigo-200 mb-2 font-semibold">Jules & GitHub Integration</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Connect to GitHub to view workflow runs and artifacts.
                    </Text>

                    <Input
                        label="GitHub Client ID"
                        value={githubClientId}
                        onChangeText={onChangeGithubClientId}
                        placeholder="Client ID"
                    />
                    <Input
                        label="GitHub Client Secret"
                        value={githubClientSecret}
                        onChangeText={onChangeGithubClientSecret}
                        placeholder="Client Secret"
                        secureTextEntry
                    />

                    <TouchableOpacity
                        onPress={onLoginGithub}
                        disabled={!githubRequest || isGithubConfigDirty}
                        className={`bg-indigo-600 px-8 py-3 rounded-xl flex-row items-center justify-center mb-6 ${(!githubRequest || isGithubConfigDirty) ? 'opacity-50' : ''}`}
                    >
                        <Ionicons name="logo-github" size={24} color="white" />
                        <Text className="text-white font-bold ml-2">
                            {isGithubConfigDirty ? "Saving..." : (isGithubLoggedIn ? "Re-Login with GitHub" : "Login with GitHub")}
                        </Text>
                    </TouchableOpacity>

                    {isGithubLoggedIn && (
                        <View className="bg-green-900/20 border border-green-500/30 p-3 rounded-xl flex-row items-center mb-6">
                            <Ionicons name="checkmark-circle" size={20} color="#4ade80" />
                            <Text className="text-green-400 font-medium ml-2">GitHub Connected</Text>
                        </View>
                    )}

                    <Text className="text-indigo-200 mt-2 mb-2 font-semibold">Google Jules API</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Direct integration with the Google Jules REST API.
                    </Text>
                    <Input
                        label="API Key"
                        value={julesGoogleApiKey}
                        onChangeText={onChangeJulesGoogleApiKey}
                        placeholder="AQ..."
                        secureTextEntry
                    />
                </View>
            </Card>
        </View>
    );
}
