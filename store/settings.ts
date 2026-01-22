import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    apiKey: string | null;
    vaultUri: string | null;
    customPromptPath: string | null;
    selectedModel: string;
    contextRootFolder: string;
    setApiKey: (key: string) => void;
    setVaultUri: (uri: string) => void;
    setCustomPromptPath: (path: string) => void;
    setSelectedModel: (model: string) => void;
    setContextRootFolder: (folder: string) => void;
    googleAndroidClientId: string | null;
    googleIosClientId: string | null;
    googleWebClientId: string | null;
    setGoogleAndroidClientId: (id: string) => void;
    setGoogleIosClientId: (id: string) => void;
    setGoogleWebClientId: (id: string) => void;
    remindersScanFolder: string | null;
    setRemindersScanFolder: (folder: string) => void;
    backgroundSyncInterval: number;
    setBackgroundSyncInterval: (interval: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: null,
            vaultUri: null,
            customPromptPath: null,
            selectedModel: 'gemini-3-flash-preview',
            contextRootFolder: '',
            setApiKey: (key) => set({ apiKey: key }),
            setVaultUri: (uri) => set({ vaultUri: uri }),
            setCustomPromptPath: (path) => set({ customPromptPath: path }),
            setSelectedModel: (model) => set({ selectedModel: model }),
            setContextRootFolder: (folder) => set({ contextRootFolder: folder }),
            googleAndroidClientId: null,
            googleIosClientId: null,
            googleWebClientId: null,
            setGoogleAndroidClientId: (id) => set({ googleAndroidClientId: id }),
            setGoogleIosClientId: (id) => set({ googleIosClientId: id }),
            setGoogleWebClientId: (id) => set({ googleWebClientId: id }),
            remindersScanFolder: null,
            setRemindersScanFolder: (folder) => set({ remindersScanFolder: folder }),
            backgroundSyncInterval: 15,
            setBackgroundSyncInterval: (interval) => set({ backgroundSyncInterval: interval }),
        }),
        {
            name: 'ai-inbox-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
