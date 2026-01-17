import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsState {
    apiKey: string | null;
    vaultUri: string | null;
    customPrompt: string | null;
    selectedModel: string;
    contextRootFolder: string;
    setApiKey: (key: string) => void;
    setVaultUri: (uri: string) => void;
    setCustomPrompt: (prompt: string) => void;
    setSelectedModel: (model: string) => void;
    setContextRootFolder: (folder: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: null,
            vaultUri: null,
            customPrompt: null,
            selectedModel: 'gemini-3-flash-preview',
            contextRootFolder: '',
            setApiKey: (key) => set({ apiKey: key }),
            setVaultUri: (uri) => set({ vaultUri: uri }),
            setCustomPrompt: (prompt) => set({ customPrompt: prompt }),
            setSelectedModel: (model) => set({ selectedModel: model }),
            setContextRootFolder: (folder) => set({ contextRootFolder: folder }),
        }),
        {
            name: 'ai-inbox-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
