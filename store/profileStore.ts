import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProfileService, ProfileData, DEFAULT_PROFILE } from '../services/profileService';
import { useSettingsStore } from './settings';

interface ProfileConfig {
    targetTopic?: string;
    questionCount: number;
    forbiddenTopics: string[];
}

interface ProfileState {
    profile: ProfileData;
    dailyQuestions: string[];
    dailyReasoning: string;
    answers: Record<string, string>;
    lastGeneratedDate: string;
    isLoading: boolean;
    config: ProfileConfig;

    // Actions
    loadFromVault: () => Promise<void>;
    generateQuestions: () => Promise<void>;
    submitAnswers: () => Promise<void>;
    updateConfig: (config: Partial<ProfileConfig>) => void;
    setAnswer: (question: string, text: string) => void;
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
            config: {
                questionCount: 3,
                forbiddenTopics: []
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

            generateQuestions: async () => {
                const { apiKey } = useSettingsStore.getState();
                const { profile, config, dailyQuestions, lastGeneratedDate } = get();

                // Check if already generated today
                const today = new Date().toISOString().split('T')[0];
                if (lastGeneratedDate === today) {
                    return;
                }

                if (!apiKey) {
                    console.warn('[ProfileStore] No API key');
                    return;
                }

                set({ isLoading: true });
                try {
                    // Use question history (maybe from previous days? or just current session?)
                    // The prompt asks for "Interaction History".
                    // For now, we can pass recent questions from the profile if we stored them,
                    // or just empty if it's a new day.
                    const history: string[] = [];

                    const result = await ProfileService.generateDailyQuestions(
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
                const { apiKey, vaultUri } = useSettingsStore.getState();
                const { profile, dailyQuestions, answers } = get();

                if (!apiKey || !vaultUri) return;

                set({ isLoading: true });
                try {
                    const updatedProfile = await ProfileService.processAnswers(
                        apiKey,
                        profile,
                        dailyQuestions,
                        answers
                    );

                    await ProfileService.saveProfile(vaultUri, updatedProfile);

                    set({
                        profile: updatedProfile,
                        dailyQuestions: [], // Clear questions after submission
                        answers: {},
                        isLoading: false
                    });
                } catch (e) {
                    console.error('[ProfileStore] Failed to submit answers', e);
                    set({ isLoading: false });
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
