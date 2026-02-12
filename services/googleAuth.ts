import { refreshAsync, TokenResponse, AuthRequestConfig, ResponseType, makeRedirectUri } from 'expo-auth-session';
import { useGoogleStore } from '../store/googleStore';
import { useSettingsStore } from '../store/settings';

const DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};
const googleAndroidClientId = "761766309334-kqgseihn4uua35rr6pk3q5nod5l0ad3h.apps.googleusercontent.com";

export class GoogleAuthService {

    static getConfig(): AuthRequestConfig {
        // Hardcoded IDs to ensure reliability across the app

        return {
            clientId: googleAndroidClientId,
            // @ts-ignore
            androidClientId: googleAndroidClientId,
            scopes: ['openid', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/tasks'],
            responseType: ResponseType.Code,
            redirectUri: 'com.aiinbox.mobile:/oauthredirect', // Use single slash as verified working
            usePKCE: true,
        };
    }

    static async refreshTokens(): Promise<string | null> {
        const { refreshToken, setAuth, clearAuth } = useGoogleStore.getState();

        if (!refreshToken || !googleAndroidClientId) {
            if (!googleAndroidClientId) console.warn('Cannot refresh token: Missing Web Client ID.');
            clearAuth();
            return null;
        }

        try {
            const response = await refreshAsync(
                {
                    clientId: googleAndroidClientId,
                    refreshToken,
                    scopes: ['openid', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/tasks'],
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
