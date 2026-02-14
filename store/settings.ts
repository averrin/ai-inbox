import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSecureStorage } from './secure-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const SENSITIVE_KEYS = [
    'apiKey',
    'googleAndroidClientId',
    'googleIosClientId',
    'googleWebClientId',
    'julesApiKey',
    'julesGoogleApiKey',
    'workAccountId',
    'personalAccountId',
    'githubClientId',
    'githubClientSecret',
    'newsApiKey',
];

export interface Contact {
    id: string;
    email: string;
    name: string;
    color?: string;
    icon?: string;
    isWife?: boolean;
}

export interface NewsArticle {
    title: string;
    description: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    source: { name: string; id: string | null };
}

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
    linksRoot: string | null;
    setLinksRoot: (folder: string) => void;
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
    hideLunchBadges: boolean;
    setHideLunchBadges: (hide: boolean) => void;
    hideDeclinedEvents: boolean;
    setHideDeclinedEvents: (hide: boolean) => void;
    defaultCalendarId: string | null;
    setDefaultCalendarId: (id: string | null) => void;
    defaultCreateCalendarId: string | null;
    setDefaultCreateCalendarId: (id: string | null) => void;
    defaultOpenCalendarId: string | null;
    setDefaultOpenCalendarId: (id: string | null) => void;
    personalCalendarIds: string[];
    setPersonalCalendarIds: (ids: string[]) => void;
    workCalendarIds: string[];
    setWorkCalendarIds: (ids: string[]) => void;
    workAccountId: string | null;
    setWorkAccountId: (id: string | null) => void;
    personalAccountId: string | null;
    setPersonalAccountId: (id: string | null) => void;
    calendarDefaultEventTypes: Record<string, string>;
    setCalendarDefaultEventTypes: (types: Record<string, string>) => void;
    julesApiKey: string | null;
    setJulesApiKey: (key: string | null) => void;
    julesOwner: string | null;
    setJulesOwner: (owner: string | null) => void;
    julesRepo: string | null;
    setJulesRepo: (repo: string | null) => void;
    julesWorkflow: string | null;
    setJulesWorkflow: (workflow: string | null) => void;
    julesGoogleApiKey: string | null;
    setJulesGoogleApiKey: (key: string | null) => void;
    githubClientId: string | null;
    setGithubClientId: (id: string | null) => void;
    githubClientSecret: string | null;
    setGithubClientSecret: (secret: string | null) => void;
    weatherLocation: { lat: number, lon: number, city?: string };
    setWeatherLocation: (location: { lat: number, lon: number, city?: string }) => void;
    useCurrentLocation: boolean;
    setUseCurrentLocation: (use: boolean) => void;
    tagConfig: Record<string, MetadataConfig>;
    propertyConfig: Record<string, MetadataConfig>;
    setTagConfig: (tag: string, config: MetadataConfig) => void;
    setPropertyConfig: (prop: string, config: MetadataConfig) => void;
    contacts: Contact[];
    setContacts: (contacts: Contact[]) => void;
    addContact: (contact: Omit<Contact, 'id'>) => void;
    updateContact: (contact: Contact) => void;
    daySummaryPrompt: string | null;
    setDaySummaryPrompt: (prompt: string | null) => void;
    forecastPrompt: string | null;
    setForecastPrompt: (prompt: string | null) => void;
    newsTopics: string[];
    setNewsTopics: (topics: string[]) => void;
    newsApiKey: string | null;
    setNewsApiKey: (key: string | null) => void;
    hiddenArticles: string[]; // List of URLs
    readArticles: NewsArticle[]; // List of full articles saved for later
    ignoredHostnames: string[];
    setIgnoredHostnames: (hostnames: string[]) => void;
    hideArticle: (url: string) => void;
    markArticleAsRead: (article: NewsArticle) => void;
}

export interface MetadataConfig {
    hidden?: boolean;
    color?: string;
    valueConfigs?: Record<string, MetadataConfig>; // For property values
}

// Custom storage adapter that reverts to AsyncStorage (plaintext) but attempts to recover
// sensitive keys from SecureStore if they are missing (migration back to stability).
const recoveryStorage = {
    getItem: async (name: string): Promise<string | null> => {
        try {
            const json = await AsyncStorage.getItem(name);
            if (!json) return null;

            const state = JSON.parse(json);

            // Attempt to recover sensitive keys from SecureStore if they are missing in AsyncStorage
            // (This handles the case where they were moved to SecureStore and stripped from AsyncStorage)
            if (state.state && Platform.OS !== 'web') {
                let recovered = false;
                for (const key of SENSITIVE_KEYS) {
                    if (state.state[key] === null) { // Only recover if null (stripped)
                        try {
                            const secureVal = await SecureStore.getItemAsync(`${name}-${key}`);
                            if (secureVal) {
                                console.log(`[Settings] Recovered ${key} from SecureStore`);
                                state.state[key] = secureVal;
                                recovered = true;
                            }
                        } catch (e) {
                            console.warn(`[Settings] Failed to recover ${key}`, e);
                        }
                    }
                }
            }

            return JSON.stringify(state);
        } catch (e) {
            console.error('[Settings] Failed to load state', e);
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        // Simple direct write to AsyncStorage (Plaintext persistence)
        // This effectively reverts the "SecureStorage" change for future writes, ensuring stability.
        await AsyncStorage.setItem(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await AsyncStorage.removeItem(name);
    }
};

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
            linksRoot: null,
            setLinksRoot: (folder) => set({ linksRoot: folder }),
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
            hideLunchBadges: true,
            setHideLunchBadges: (hide) => set({ hideLunchBadges: hide }),
            hideDeclinedEvents: false,
            setHideDeclinedEvents: (hide) => set({ hideDeclinedEvents: hide }),
            defaultCalendarId: null,
            setDefaultCalendarId: (id) => set({ defaultCalendarId: id }),
            defaultCreateCalendarId: null,
            setDefaultCreateCalendarId: (id) => set({ defaultCreateCalendarId: id }),
            defaultOpenCalendarId: null,
            setDefaultOpenCalendarId: (id) => set({ defaultOpenCalendarId: id }),
            personalCalendarIds: [],
            setPersonalCalendarIds: (ids: string[]) => set({ personalCalendarIds: ids }),
            workCalendarIds: [],
            setWorkCalendarIds: (ids: string[]) => set({ workCalendarIds: ids }),
            workAccountId: null,
            setWorkAccountId: (id) => set({ workAccountId: id }),
            personalAccountId: null,
            setPersonalAccountId: (id) => set({ personalAccountId: id }),
            calendarDefaultEventTypes: {},
            setCalendarDefaultEventTypes: (types) => set({ calendarDefaultEventTypes: types }),
            julesApiKey: null,
            setJulesApiKey: (key) => set({ julesApiKey: key }),
            julesOwner: null,
            setJulesOwner: (owner) => set({ julesOwner: owner }),
            julesRepo: null,
            setJulesRepo: (repo) => set({ julesRepo: repo }),
            julesWorkflow: null,
            setJulesWorkflow: (workflow) => set({ julesWorkflow: workflow }),
            julesGoogleApiKey: null,
            setJulesGoogleApiKey: (key) => set({ julesGoogleApiKey: key }),
            githubClientId: null,
            setGithubClientId: (id) => set({ githubClientId: id }),
            githubClientSecret: null,
            setGithubClientSecret: (secret) => set({ githubClientSecret: secret }),
            weatherLocation: { lat: 37.7749, lon: -122.4194, city: 'San Francisco' },
            setWeatherLocation: (location) => set({ weatherLocation: location }),
            useCurrentLocation: false,
            setUseCurrentLocation: (use) => set({ useCurrentLocation: use }),
            tagConfig: {},
            propertyConfig: {},
            setTagConfig: (tag, config) => set((state) => ({
                tagConfig: { ...state.tagConfig, [tag]: config }
            })),
            setPropertyConfig: (prop, config) => set((state) => ({
                propertyConfig: { ...state.propertyConfig, [prop]: config }
            })),
            contacts: [],
            setContacts: (contacts) => set({ contacts }),
            addContact: (contact) => set((state) => ({
                contacts: [...state.contacts, { ...contact, id: Crypto.randomUUID() }]
            })),
            updateContact: (contact) => set((state) => ({
                contacts: state.contacts.map(c => c.id === contact.id ? contact : c)
            })),
            deleteContact: (id: string) => set((state) => ({
                contacts: state.contacts.filter(c => c.id !== id)
            })),
            daySummaryPrompt: null,
            setDaySummaryPrompt: (prompt) => set({ daySummaryPrompt: prompt }),
            forecastPrompt: null,
            setForecastPrompt: (prompt) => set({ forecastPrompt: prompt }),
            newsTopics: ['Technology', 'AI', 'Science'],
            setNewsTopics: (topics) => set({ newsTopics: topics }),
            newsApiKey: null,
            setNewsApiKey: (key) => set({ newsApiKey: key }),
            hiddenArticles: [],
            readArticles: [],
            ignoredHostnames: [],
            setIgnoredHostnames: (hostnames) => set({ ignoredHostnames: hostnames }),
            hideArticle: (url) => set((state) => ({
                hiddenArticles: state.hiddenArticles.includes(url) ? state.hiddenArticles : [...state.hiddenArticles, url]
            })),
            markArticleAsRead: (article) => set((state) => ({
                readArticles: state.readArticles.some(a => a.url === article.url) ? state.readArticles : [...state.readArticles, article]
            })),
        }),
        {
            name: 'ai-inbox-settings',
            storage: createJSONStorage(() => recoveryStorage),
            partialize: (state) => {
                // Exclude cachedReminders from persistence
                const { cachedReminders, ...rest } = state;
                return rest;
            },
            version: 6,
            migrate: (persistedState: any, version: number) => {
                if (version === 0) {
                    if (persistedState.defaultCalendarId && !persistedState.defaultCreateCalendarId) {
                        persistedState.defaultCreateCalendarId = persistedState.defaultCalendarId;
                    }
                    if (persistedState.defaultCalendarId && !persistedState.defaultOpenCalendarId) {
                        persistedState.defaultOpenCalendarId = persistedState.defaultCalendarId;
                    }
                }
                if (version < 2) {
                    persistedState.personalCalendarIds = persistedState.personalCalendarIds || [];
                    persistedState.workCalendarIds = persistedState.workCalendarIds || [];
                    persistedState.workAccountId = persistedState.workAccountId || null;
                    persistedState.calendarDefaultEventTypes = persistedState.calendarDefaultEventTypes || {};
                }
                if (version < 4) {
                    if (persistedState.myEmails && persistedState.myEmails.length > 0) {
                        if (!persistedState.personalAccountId) {
                            persistedState.personalAccountId = persistedState.myEmails[0];
                        }
                        if (persistedState.myEmails.length > 1 && !persistedState.workAccountId) {
                            persistedState.workAccountId = persistedState.myEmails[1];
                        }
                    }
                }
                if (version < 6) {
                    persistedState.ignoredHostnames = persistedState.ignoredHostnames || [];
                }
                return persistedState;
            },
        }
    )
);

// End of store definition