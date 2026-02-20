import { View, Text } from 'react-native';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { CloudSyncSettings } from './CloudSyncSettings';
import { ServiceAuth } from './ServiceAuth';
import { AuthRequest } from 'expo-auth-session';

interface IntegrationsSettingsProps {
    // Gemini
    apiKey: string;
    onChangeApiKey: (text: string) => void;

    // GitHub
    githubClientId: string;
    onChangeGithubClientId: (text: string) => void;
    githubClientSecret: string;
    onChangeGithubClientSecret: (text: string) => void;
    onLoginGithub: () => void;
    onLogoutGithub?: () => void;
    githubRequest: AuthRequest | null;
    isGithubConfigDirty?: boolean;
    julesApiKey: string | null; // GitHub Personal Access Token or OAuth Token

    // Jules
    julesGoogleApiKey: string;
    onChangeJulesGoogleApiKey: (text: string) => void;
}

export function IntegrationsSettings({
    apiKey, onChangeApiKey,
    githubClientId, onChangeGithubClientId,
    githubClientSecret, onChangeGithubClientSecret,
    onLoginGithub, onLogoutGithub, githubRequest, isGithubConfigDirty,
    julesApiKey,
    julesGoogleApiKey, onChangeJulesGoogleApiKey,
}: IntegrationsSettingsProps) {
    const isGithubLoggedIn = !!julesApiKey;

    return (
        <View>
            <Card>
                <View className="mb-4">
                    <Text className="text-text-secondary mb-2 font-semibold text-lg">Gemini AI</Text>
                    <Text className="text-text-tertiary text-sm mb-4">
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

            <ServiceAuth
                title="GitHub Integration"
                description="Connect to GitHub to view workflow runs and artifacts."
                icon="logo-github"
                isConnected={isGithubLoggedIn}
                connectedText="GitHub Connected"
                onConnect={onLoginGithub}
                onDisconnect={onLogoutGithub}
                connectButtonText={isGithubConfigDirty ? "Save Settings first" : "Login with GitHub"}
                disconnectButtonText="Disconnect GitHub"
                isDisabled={!githubRequest || isGithubConfigDirty}
                isConnecting={false} // Loading state handled by setup screen usually, or we can add prop
            >
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
            </ServiceAuth>

            <Card>
                <View className="mb-4">
                    <Text className="text-text-secondary mb-2 font-semibold text-lg">Google Jules API</Text>
                    <Text className="text-text-tertiary text-sm mb-4">
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
