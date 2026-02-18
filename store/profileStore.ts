import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ProfileService, ProfileData, DEFAULT_PROFILE } from '../services/profileService';
import { useSettingsStore } from './settings';
import { generateImage } from '../services/gemini';

interface ProfileConfig {
    targetTopic?: string;
    questionCount: number;
    forbiddenTopics: string[];
    abstractionLevel: number; // 0 (Low/Fact) to 1 (High/Philosophy)
}

interface ProfileState {
    profile: ProfileData;
    dailyQuestions: { text: string; level: number }[];
    dailyReasoning: string;
    answers: Record<string, string>;
    lastGeneratedDate: string;
    isLoading: boolean;
    isGeneratingImage: boolean;
    config: ProfileConfig;

    // Actions
    loadFromVault: () => Promise<void>;
    generateQuestions: (force?: boolean) => Promise<void>;
    submitAnswers: () => Promise<void>;
    generateProfileImage: () => Promise<void>;
    updateConfig: (config: Partial<ProfileConfig>) => void;
    setAnswer: (question: string, text: string) => void;
    deleteFact: (key: string) => Promise<void>;
    updateFact: (key: string, value: any) => Promise<void>;
    addFactFromText: (text: string) => Promise<void>;
    resetDaily: () => void;
}

export const useProfileStore = create<ProfileState>()(
    persist(
        (set, get) => ({
            profile: DEFAULT_PROFILE,
            dailyQuestions: [],
            dailyReasoning: '',
            answers: {},
            lastGeneratedDate: '',
            isLoading: false,
            isGeneratingImage: false,
            config: {
                questionCount: 3,
                forbiddenTopics: [],
                abstractionLevel: 0.5
            },

            loadFromVault: async () => {
                const { vaultUri } = useSettingsStore.getState();
                if (!vaultUri) return;

                set({ isLoading: true });
                try {
                    const profile = await ProfileService.loadProfile(vaultUri);
                    set({ profile, isLoading: false });
                } catch (e) {
                    console.error('[ProfileStore] Failed to load profile', e);
                    set({ isLoading: false });
                }
            },

            generateQuestions: async (force: boolean = false) => {
                const { apiKey, selectedModel } = useSettingsStore.getState();
                const { profile, config, dailyQuestions, lastGeneratedDate } = get();

                // Check if already generated today
                const today = new Date().toISOString().split('T')[0];
                if (!force && lastGeneratedDate === today) {
                    return;
                }

                if (!apiKey) {
                    console.warn('[ProfileStore] No API key');
                    return;
                }

                set({ isLoading: true });
                try {
                    const history: string[] = [];

                    const result = await ProfileService.generateDailyQuestions(
                        selectedModel,
                        apiKey,
                        profile,
                        history,
                        config
                    );

                    set({
                        dailyQuestions: result.questions,
                        dailyReasoning: result.reasoning,
                        answers: {}, // Clear answers for new questions
                        lastGeneratedDate: today,
                        isLoading: false
                    });
                } catch (e) {
                    console.error('[ProfileStore] Failed to generate questions', e);
                    set({ isLoading: false });
                }
            },

            submitAnswers: async () => {
                const { apiKey, vaultUri, selectedModel } = useSettingsStore.getState();
                const { profile, dailyQuestions, answers } = get();

                if (!apiKey || !vaultUri) return;

                set({ isLoading: true });
                try {
                    console.log('[ProfileStore] processing answers with questions:', dailyQuestions.map(q => q.text));
                    const updatedProfile = await ProfileService.processAnswers(
                        selectedModel,
                        apiKey,
                        profile,
                        dailyQuestions.map(q => q.text),
                        answers
                    );

                    console.log('[ProfileStore] Saving updated profile to vault:', vaultUri);
                    await ProfileService.saveProfile(vaultUri, updatedProfile);

                    set({
                        profile: updatedProfile,
                        dailyQuestions: [], // Clear questions after submission
                        answers: {},
                        isLoading: false
                    });

                    // Trigger image regeneration
                    get().generateProfileImage();
                } catch (e) {
                    console.error('[ProfileStore] Failed to submit answers', e);
                    set({ isLoading: false });
                }
            },

            generateProfileImage: async () => {
                const { apiKey, selectedImageModel, vaultUri, visualizationPrompt } = useSettingsStore.getState();
                const { profile } = get();

                if (!apiKey || !selectedImageModel) {
                    console.warn('[ProfileStore] Missing API key or Image Model');
                    return;
                }

                set({ isGeneratingImage: true });
                console.log(`[ProfileStore] Generating image with model: ${selectedImageModel}`);

                try {
                    const prompt = ProfileService.generateProfileImagePrompt(profile, visualizationPrompt || undefined);
                    const base64 = await generateImage(apiKey, prompt, selectedImageModel);

                    if (base64) {
                        // Delete old image if it exists to save space
                        if (profile.profileImage) {
                            try {
                                const oldExists = await FileSystem.getInfoAsync(profile.profileImage);
                                if (oldExists.exists) {
                                    await FileSystem.deleteAsync(profile.profileImage, { idempotent: true });
                                }
                            } catch (e) {
                                console.warn('[ProfileStore] Failed to cleanup old image:', e);
                            }
                        }

                        // Save to document directory with timestamp to avoid URI caching
                        const timestamp = Date.now();
                        const fileName = `profile_viz_${timestamp}.png`;
                        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

                        await FileSystem.writeAsStringAsync(fileUri, base64, {
                            encoding: 'base64'
                        });

                        // Update profile with new URI
                        const updatedProfile = { ...profile, profileImage: fileUri, lastUpdated: new Date().toISOString() };

                        set({ profile: updatedProfile });

                        // Save profile metadata to vault
                        if (vaultUri) {
                            await ProfileService.saveProfile(vaultUri, updatedProfile);
                        }

                        console.log('[ProfileStore] New visualization saved:', fileUri);
                    } else {
                        console.warn('[ProfileStore] Image generation returned null');
                    }
                } catch (e: any) {
                    console.error('[ProfileStore] Failed to generate profile image', JSON.stringify(e, Object.getOwnPropertyNames(e)));
                } finally {
                    set({ isGeneratingImage: false });
                }
            },


            updateConfig: (newConfig) => {
                set((state) => ({
                    config: { ...state.config, ...newConfig }
                }));
            },

            setAnswer: (question, text) => {
                set((state) => ({
                    answers: { ...state.answers, [question]: text }
                }));
            },

            deleteFact: async (key: string) => {
                const { profile } = get();
                const { vaultUri } = useSettingsStore.getState();
                if (!vaultUri) return;

                const newFacts = { ...profile.facts };
                delete newFacts[key];

                const updatedProfile = { ...profile, facts: newFacts, lastUpdated: new Date().toISOString() };

                set({ isLoading: true });
                try {
                    await ProfileService.saveProfile(vaultUri, updatedProfile);
                    set({ profile: updatedProfile, isLoading: false });
                    // Trigger image regeneration
                    get().generateProfileImage();
                } catch (e) {
                    console.error('[ProfileStore] Failed to delete fact', e);
                    set({ isLoading: false });
                }
            },

            updateFact: async (key: string, value: any) => {
                const { profile } = get();
                const { vaultUri } = useSettingsStore.getState();
                if (!vaultUri) return;

                const newFacts = { ...profile.facts, [key]: value };
                const updatedProfile = { ...profile, facts: newFacts, lastUpdated: new Date().toISOString() };

                set({ isLoading: true });
                try {
                    await ProfileService.saveProfile(vaultUri, updatedProfile);
                    set({ profile: updatedProfile, isLoading: false });
                    // Trigger image regeneration
                    get().generateProfileImage();
                } catch (e) {
                    console.error('[ProfileStore] Failed to update fact', e);
                    set({ isLoading: false });
                }
            },

            addFactFromText: async (text: string) => {
                const { apiKey, vaultUri, selectedModel } = useSettingsStore.getState();
                const { profile } = get();

                if (!apiKey || !vaultUri) {
                    console.warn('[ProfileStore] Missing API key or Vault URI');
                    return;
                }

                set({ isLoading: true });
                try {
                    const updatedProfile = await ProfileService.processFreeFormInput(
                        selectedModel,
                        apiKey,
                        profile,
                        text
                    );

                    await ProfileService.saveProfile(vaultUri, updatedProfile);
                    set({ profile: updatedProfile, isLoading: false });

                    // Trigger image regeneration
                    get().generateProfileImage();
                } catch (e) {
                    console.error('[ProfileStore] Failed to add fact from text', e);
                    set({ isLoading: false });
                    throw e;
                }
            },

            resetDaily: () => {
                set({
                    dailyQuestions: [],
                    dailyReasoning: '',
                    answers: {},
                    lastGeneratedDate: ''
                });
            }
        }),
        {
            name: 'profile-storage',
            storage: createJSONStorage(() => AsyncStorage),
            version: 1,
            migrate: (persistedState: any, version: number) => {
                if (version === 0) {
                    // Migrate dailyQuestions from string[] to { text: string, level: number }[]
                    if (Array.isArray(persistedState.dailyQuestions)) {
                        persistedState.dailyQuestions = persistedState.dailyQuestions.map((q: any) =>
                            typeof q === 'string' ? { text: q, level: 0.5 } : q
                        );
                    }
                }
                return persistedState;
            },
            partialize: (state) => ({
                profile: state.profile,
                dailyQuestions: state.dailyQuestions,
                dailyReasoning: state.dailyReasoning,
                answers: state.answers,
                lastGeneratedDate: state.lastGeneratedDate,
                config: state.config
            }),
        }
    )
);
