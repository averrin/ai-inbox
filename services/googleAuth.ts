import { refreshAsync, TokenResponse, AuthRequestConfig, ResponseType } from 'expo-auth-session';
import { useGoogleStore } from '../store/googleStore';
import { useSettingsStore } from '../store/settings';

const DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export class GoogleAuthService {

    static getConfig(): AuthRequestConfig {
        const { googleAndroidClientId, googleIosClientId, googleWebClientId } = useSettingsStore.getState();
        return {
            clientId: googleWebClientId || '',
            // @ts-ignore
            iosClientId: googleIosClientId || undefined,
            // @ts-ignore
            androidClientId: googleAndroidClientId || undefined,
            scopes: ['https://www.googleapis.com/auth/tasks'],
            responseType: ResponseType.Code,
            redirectUri: 'com.aiinbox.mobile:/oauth2redirect',
            usePKCE: true,
        };
    }

    static async refreshTokens(): Promise<string | null> {
        const { refreshToken, setAuth, clearAuth } = useGoogleStore.getState();
        const { googleWebClientId } = useSettingsStore.getState();

        if (!refreshToken || !googleWebClientId) {
            if (!googleWebClientId) console.warn('Cannot refresh token: Missing Web Client ID.');
            clearAuth();
            return null;
        }

        try {
            const response = await refreshAsync(
                {
                    clientId: googleWebClientId,
                    refreshToken,
                    scopes: ['https://www.googleapis.com/auth/tasks'],
                },
                DISCOVERY
            );

            if (response.accessToken) {
                setAuth(response.accessToken, response.refreshToken || refreshToken);
                return response.accessToken;
            }
        } catch (error) {
            console.error('Failed to refresh token:', error);
            clearAuth();
        }
        return null;
    }

    static async getValidToken(): Promise<string | null> {
        const { accessToken } = useGoogleStore.getState();
        // Check local expiration or validity logic here if desired
        return accessToken;
    }
}
