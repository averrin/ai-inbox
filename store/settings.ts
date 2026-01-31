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
    defaultReminderFolder: string | null;
    setDefaultReminderFolder: (folder: string) => void;
    backgroundSyncInterval: number;
    setBackgroundSyncInterval: (interval: number) => void;
    reminderBypassDnd: boolean;
    setReminderBypassDnd: (bypass: boolean) => void;
    reminderRingtone: string | null;
    setReminderRingtone: (ringtone: string) => void;
    reminderVibration: boolean;
    setReminderVibration: (vibrate: boolean) => void;
    timeFormat: '12h' | '24h';
    setTimeFormat: (format: '12h' | '24h') => void;
    cachedReminders: any[]; // Using any[] to avoid circular dependency with Reminder type
    setCachedReminders: (reminders: any[]) => void;
    editorType: 'rich' | 'simple';
    setEditorType: (type: 'rich' | 'simple') => void;
    visibleCalendarIds: string[];
    setVisibleCalendarIds: (ids: string[]) => void;
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
            defaultReminderFolder: null,
            setDefaultReminderFolder: (folder) => set({ defaultReminderFolder: folder }),
            backgroundSyncInterval: 15,
            setBackgroundSyncInterval: (interval) => set({ backgroundSyncInterval: interval }),
            reminderBypassDnd: true,
            setReminderBypassDnd: (bypass) => set({ reminderBypassDnd: bypass }),
            reminderRingtone: null,
            setReminderRingtone: (ringtone) => set({ reminderRingtone: ringtone }),
            reminderVibration: true,
            setReminderVibration: (vibrate) => set({ reminderVibration: vibrate }),
            timeFormat: '24h',
            setTimeFormat: (format) => set({ timeFormat: format }),
            cachedReminders: [],
            setCachedReminders: (reminders) => set({ cachedReminders: reminders }),
            editorType: 'rich',
            setEditorType: (type) => set({ editorType: type }),
            visibleCalendarIds: [],
            setVisibleCalendarIds: (ids) => set({ visibleCalendarIds: ids }),
        }),
        {
            name: 'ai-inbox-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
