import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MoodEntry {
    mood: number; // 1 to 5
    note: string;
}

interface MoodState {
    moods: Record<string, MoodEntry>;
    moodReminderEnabled: boolean;
    moodReminderTime: string; // ISO string for time
    setMood: (date: string, mood: number, note: string) => void;
    setMoodReminder: (enabled: boolean, time: string) => void;
}

export const useMoodStore = create<MoodState>()(
    persist(
        (set) => ({
            moods: {},
            moodReminderEnabled: false,
            moodReminderTime: new Date().setHours(20, 0, 0, 0) ? new Date(new Date().setHours(20, 0, 0, 0)).toISOString() : new Date().toISOString(),
            setMood: (date, mood, note) => set((state) => ({
                moods: {
                    ...state.moods,
                    [date]: { mood, note }
                }
            })),
            setMoodReminder: (enabled, time) => set({
                moodReminderEnabled: enabled,
                moodReminderTime: time
            }),
        }),
        {
            name: 'mood-store',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
