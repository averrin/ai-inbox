import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType, EventTypeConfig, loadEventTypesFromVault } from '../services/eventTypeService';
import { useSettingsStore } from './settings';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';
import * as Crypto from 'expo-crypto';
import {
    doc,
    getDoc,
    setDoc
} from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from '../services/firebase';

interface EventTypesState {
    eventTypes: EventType[];
    assignments: Record<string, string>; // Event Title -> Type ID
    difficulties: Record<string, number>; // Event Title -> Difficulty
    ranges: TimeRangeDefinition[];
    eventFlags: Record<string, { isEnglish?: boolean; movable?: boolean; skippable?: boolean; needPrep?: boolean; completable?: boolean }>; // Event Title -> Flags
    eventIcons: Record<string, string>; // Event Title -> Icon Name
    completedEvents: Record<string, boolean>; // "title::YYYY-MM-DD" -> true
    lunchConfig: { targetCalendarId?: string; defaultInvitee?: string };
    isLoaded: boolean;
    loadConfig: () => Promise<void>;
    addType: (type: EventType) => Promise<void>;
    updateType: (type: EventType) => Promise<void>;
    deleteType: (id: string) => Promise<void>;
    assignTypeToTitle: (title: string, typeId: string) => Promise<void>;
    unassignType: (title: string) => Promise<void>;
    setDifficulty: (title: string, level: number) => Promise<void>;
    setEventIcon: (title: string, icon: string) => Promise<void>;
    addRange: (range: Omit<TimeRangeDefinition, 'id' | 'isEnabled'>) => Promise<void>;
    updateRange: (id: string, updates: Partial<Omit<TimeRangeDefinition, 'id'>>) => Promise<void>;
    deleteRange: (id: string) => Promise<void>;
    toggleRange: (id: string) => Promise<void>;
    toggleEventFlag: (title: string, flag: 'isEnglish' | 'movable' | 'skippable' | 'needPrep' | 'completable') => Promise<void>;
    toggleCompleted: (title: string, dateStr: string) => void;
    updateLunchConfig: (config: { targetCalendarId?: string; defaultInvitee?: string }) => Promise<void>;
    syncToFirestore: () => Promise<void>; // Direct sync
}

export const useEventTypesStore = create<EventTypesState>()(
    persist(
        (set, get) => ({
            eventTypes: [],
            assignments: {},
            difficulties: {},
            ranges: [],
            eventFlags: {},
            eventIcons: {},
            completedEvents: {},
            lunchConfig: {},
            isLoaded: false,

            syncToFirestore: async () => {
                const user = firebaseAuth.currentUser;
                if (!user) return;

                const state = get();
                
                // Helper to remove empty keys
                const sanitize = <T>(obj: Record<string, T>) => {
                    const clean: Record<string, T> = {};
                    Object.keys(obj).forEach(key => {
                        if (key && key.trim().length > 0) {
                            clean[key] = obj[key];
                        }
                    });
                    return clean;
                };

                const config: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: sanitize(state.assignments),
                    difficulties: sanitize(state.difficulties),
                    ranges: state.ranges,
                    eventFlags: sanitize(state.eventFlags),
                    eventIcons: sanitize(state.eventIcons),
                    lunchConfig: state.lunchConfig
                };

                try {
                    const docRef = doc(firebaseDb, 'users', user.uid, 'config', 'eventTypes');
                    await setDoc(docRef, config);
                } catch (e) {
                    console.error('[EventTypesStore] Firestore sync failed:', e);
                }
            },

            loadConfig: async () => {
                const user = firebaseAuth.currentUser;
                if (!user) {
                    set({ isLoaded: true });
                    return;
                }

                try {
                    const docRef = doc(firebaseDb, 'users', user.uid, 'config', 'eventTypes');
                    const snap = await getDoc(docRef);

                    if (snap.exists()) {
                        const config = snap.data() as EventTypeConfig;
                        set({
                            eventTypes: config.types || [],
                            assignments: config.assignments || {},
                            difficulties: config.difficulties || {},
                            ranges: config.ranges || [],
                            eventFlags: config.eventFlags || {},
                            eventIcons: config.eventIcons || {},
                            lunchConfig: config.lunchConfig || {},
                            isLoaded: true
                        });
                    } else {
                        // MIGRATION: Try loading from legacy Vault
                        const vaultUri = useSettingsStore.getState().vaultUri;
                        if (vaultUri) {
                            const legacyConfig = await loadEventTypesFromVault(vaultUri);
                            if (legacyConfig) {
                                console.log('[EventTypesStore] Migrating legacy config to Firestore...');
                                set({
                                    eventTypes: legacyConfig.types,
                                    assignments: legacyConfig.assignments,
                                    difficulties: legacyConfig.difficulties || {},
                                    ranges: legacyConfig.ranges || [],
                                    eventFlags: legacyConfig.eventFlags || {},
                                    eventIcons: legacyConfig.eventIcons || {},
                                    lunchConfig: legacyConfig.lunchConfig || {},
                                    isLoaded: true
                                });
                                // Save it to Firestore immediately
                                await get().syncToFirestore();
                            }
                        }
                        set({ isLoaded: true });
                    }

                    // Ensure "Walk" range exists (default if missing)
                    const state = get();
                    if (!state.ranges.some(r => r.title === 'Walk')) {
                        console.log('[EventTypesStore] Creating default Walk range');
                        await state.addRange({
                            title: 'Walk',
                            start: { hour: 10, minute: 0 },
                            end: { hour: 19, minute: 0 },
                            days: [1, 2, 3, 4, 5], // Mon-Fri
                            color: '#10b981',
                            isWork: false,
                            isVisible: false
                        } as any);
                    }
                } catch (e) {
                    console.error('[EventTypesStore] Failed to load config:', e);
                    set({ isLoaded: true });
                }
            },

            addType: async (type) => {
                const state = get();
                const newTypes = [...state.eventTypes, type];
                set({ eventTypes: newTypes });
                await get().syncToFirestore();
            },

            updateType: async (updatedType) => {
                const state = get();
                const newTypes = state.eventTypes.map(t =>
                    t.id === updatedType.id ? updatedType : t
                );
                set({ eventTypes: newTypes });
                await get().syncToFirestore();
            },

            deleteType: async (id) => {
                const state = get();
                const newTypes = state.eventTypes.filter(t => t.id !== id);

                // Cleanup assignments
                const newAssignments = { ...state.assignments };
                Object.keys(newAssignments).forEach(title => {
                    if (newAssignments[title] === id) {
                        delete newAssignments[title];
                    }
                });

                set({ eventTypes: newTypes, assignments: newAssignments });
                await get().syncToFirestore();
            },

            assignTypeToTitle: async (title, typeId) => {
                if (!title) return;
                const state = get();
                const newAssignments = {
                    ...state.assignments,
                    [title]: typeId
                };
                set({ assignments: newAssignments });
                await get().syncToFirestore();
            },

            unassignType: async (title) => {
                if (!title) return;
                const state = get();
                const newAssignments = { ...state.assignments };
                delete newAssignments[title];
                set({ assignments: newAssignments });
                await get().syncToFirestore();
            },

            setDifficulty: async (title, level) => {
                if (!title) return;
                const state = get();
                const newDifficulties = {
                    ...state.difficulties,
                    [title]: level
                };
                set({ difficulties: newDifficulties });
                await get().syncToFirestore();
            },

            setEventIcon: async (title, icon) => {
                if (!title) return;
                const state = get();
                const newEventIcons = {
                    ...state.eventIcons,
                    [title]: icon
                };
                set({ eventIcons: newEventIcons });
                await get().syncToFirestore();
            },

            addRange: async (range) => {
                const state = get();
                const newRange: TimeRangeDefinition = {
                    ...range,
                    id: Crypto.randomUUID(),
                    isEnabled: true
                };
                const newRanges = [...state.ranges, newRange];
                set({ ranges: newRanges });
                await get().syncToFirestore();
            },

            updateRange: async (id, updates) => {
                const state = get();
                const newRanges = state.ranges.map(range =>
                    range.id === id ? { ...range, ...updates } : range
                );
                set({ ranges: newRanges });
                await get().syncToFirestore();
            },

            deleteRange: async (id) => {
                const state = get();
                const newRanges = state.ranges.filter(range => range.id !== id);
                set({ ranges: newRanges });
                await get().syncToFirestore();
            },

            toggleRange: async (id) => {
                const state = get();
                const newRanges = state.ranges.map(range =>
                    range.id === id ? { ...range, isEnabled: !range.isEnabled } : range
                );
                set({ ranges: newRanges });
                await get().syncToFirestore();
            },

            toggleEventFlag: async (title, flag) => {
                if (!title) return;
                const state = get();
                const currentFlags = state.eventFlags[title] || {};
                const newFlags = {
                    ...state.eventFlags,
                    [title]: {
                        ...currentFlags,
                        [flag]: !currentFlags[flag]
                    }
                };
                set({ eventFlags: newFlags });
                await get().syncToFirestore();
            },

            toggleCompleted: (title, dateStr) => {
                const key = `${title}::${dateStr}`;
                const state = get();
                const newCompleted = { ...state.completedEvents };
                if (newCompleted[key]) {
                    delete newCompleted[key];
                } else {
                    newCompleted[key] = true;
                }
                set({ completedEvents: newCompleted });
                // We don't sync completedEvents to configuration doc in Firestore for now
            },

            updateLunchConfig: async (config) => {
                const state = get();
                set({ lunchConfig: { ...state.lunchConfig, ...config } });
                await get().syncToFirestore();
            }
        }),
        {
            name: 'event-types-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                eventTypes: state.eventTypes,
                assignments: state.assignments,
                difficulties: state.difficulties,
                ranges: state.ranges,
                eventFlags: state.eventFlags,
                eventIcons: state.eventIcons,
                completedEvents: state.completedEvents,
                lunchConfig: state.lunchConfig
            }), // Don't persist isLoaded
        }
    )
)
