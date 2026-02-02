import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface HabitDefinition {
    id: string;
    title: string;
    icon: string;
    color: string;
    isEnabled: boolean;
}

interface HabitState {
    habits: HabitDefinition[];
    records: Record<string, Record<string, boolean>>; // DateString -> { HabitID: Completed }
    
    addHabit: (habit: Omit<HabitDefinition, 'id' | 'isEnabled'>) => void;
    updateHabit: (id: string, updates: Partial<Omit<HabitDefinition, 'id'>>) => void;
    deleteHabit: (id: string) => void;
    toggleHabit: (id: string) => void;
    
    setHabitStatus: (date: string, habitId: string, completed: boolean) => void;
    getHabitStatus: (date: string, habitId: string) => boolean;
}

export const useHabitStore = create<HabitState>()(
    persist(
        (set, get) => ({
            habits: [],
            records: {},

            addHabit: (habit) => set((state) => ({
                habits: [...state.habits, {
                    ...habit,
                    id: Crypto.randomUUID(),
                    isEnabled: true
                }]
            })),

            updateHabit: (id, updates) => set((state) => ({
                habits: state.habits.map((h) => 
                    h.id === id ? { ...h, ...updates } : h
                )
            })),

            deleteHabit: (id) => set((state) => ({
                habits: state.habits.filter((h) => h.id !== id),
                // Optional: Cleanup records for this habit? 
                // Keeping them for now in case of restoration or historical data analysis
            })),

            toggleHabit: (id) => set((state) => ({
                habits: state.habits.map((h) => 
                    h.id === id ? { ...h, isEnabled: !h.isEnabled } : h
                )
            })),

            setHabitStatus: (date, habitId, completed) => set((state) => ({
                records: {
                    ...state.records,
                    [date]: {
                        ...(state.records[date] || {}),
                        [habitId]: completed
                    }
                }
            })),

            getHabitStatus: (date, habitId) => {
                const state = get();
                return state.records[date]?.[habitId] || false;
            }
        }),
        {
            name: 'habit-store',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
