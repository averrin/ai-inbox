import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WalkSuggestion {
    start: string;
    reason: string;
    date: string; // YYYY-MM-DD
}

interface WalkState {
    suggestions: Record<string, WalkSuggestion>; // date -> suggestion
    dismissedDates: string[]; // List of dates where user dismissed the suggestion

    setSuggestion: (suggestion: WalkSuggestion) => void;
    dismissForDate: (date: string) => void;
    isDismissed: (date: string) => boolean;
    clearSuggestions: () => void;
}

export const useWalkStore = create<WalkState>()(
    persist(
        (set, get) => ({
            suggestions: {},
            dismissedDates: [],

            setSuggestion: (suggestion) => set((state) => ({
                suggestions: {
                    ...state.suggestions,
                    [suggestion.date]: suggestion
                }
            })),

            dismissForDate: (date) => set((state) => {
                const newSuggestions = { ...state.suggestions };
                delete newSuggestions[date]; // Remove suggestion if dismissed
                return {
                    dismissedDates: [...state.dismissedDates, date],
                    suggestions: newSuggestions
                };
            }),

            isDismissed: (date) => get().dismissedDates.includes(date),

            clearSuggestions: () => set({ suggestions: {} }),
        }),
        {
            name: 'walk-storage-v2', // Changed name to reset storage and avoid migration issues
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                dismissedDates: state.dismissedDates,
                suggestions: state.suggestions,
            }),
        }
    )
);
