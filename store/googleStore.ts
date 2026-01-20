import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface GoogleState {
    accessToken: string | null;
    refreshToken: string | null;
    email: string | null;
    isConnected: boolean;
    setAuth: (accessToken: string, refreshToken: string | null, email?: string) => void;
    clearAuth: () => void;
    hydrate: () => Promise<void>;
}

const STORAGE_KEY_ACCESS = 'google_access_token';
const STORAGE_KEY_REFRESH = 'google_refresh_token';
const STORAGE_KEY_EMAIL = 'google_email';

export const useGoogleStore = create<GoogleState>((set) => ({
    accessToken: null,
    refreshToken: null,
    email: null,
    isConnected: false,

    setAuth: async (accessToken, refreshToken, email) => {
        if (Platform.OS !== 'web') {
            await SecureStore.setItemAsync(STORAGE_KEY_ACCESS, accessToken);
            if (refreshToken) {
                await SecureStore.setItemAsync(STORAGE_KEY_REFRESH, refreshToken);
            }
            if (email) {
                await SecureStore.setItemAsync(STORAGE_KEY_EMAIL, email);
            }
        }
        set({ accessToken, refreshToken, email, isConnected: true });
    },

    clearAuth: async () => {
        if (Platform.OS !== 'web') {
            await SecureStore.deleteItemAsync(STORAGE_KEY_ACCESS);
            await SecureStore.deleteItemAsync(STORAGE_KEY_REFRESH);
            await SecureStore.deleteItemAsync(STORAGE_KEY_EMAIL);
        }
        set({ accessToken: null, refreshToken: null, email: null, isConnected: false });
    },

    hydrate: async () => {
        if (Platform.OS !== 'web') {
            const accessToken = await SecureStore.getItemAsync(STORAGE_KEY_ACCESS);
            const refreshToken = await SecureStore.getItemAsync(STORAGE_KEY_REFRESH);
            const email = await SecureStore.getItemAsync(STORAGE_KEY_EMAIL);
            if (accessToken) {
                set({ accessToken, refreshToken, email, isConnected: true });
            }
        }
    },
}));
