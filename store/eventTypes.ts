import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType, EventTypeConfig, saveEventTypesToVault, loadEventTypesFromVault } from '../services/eventTypeService';
import { useSettingsStore } from './settings';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';
import * as Crypto from 'expo-crypto';

interface EventTypesState {
    eventTypes: EventType[];
    assignments: Record<string, string>; // Event Title -> Type ID
    difficulties: Record<string, number>; // Event Title -> Difficulty
    ranges: TimeRangeDefinition[];
    eventFlags: Record<string, { isEnglish?: boolean; movable?: boolean; skippable?: boolean }>; // Event Title -> Flags
    lunchConfig: { targetCalendarId?: string; defaultInvitee?: string };
    isLoaded: boolean;
    loadConfig: () => Promise<void>;
    addType: (type: EventType) => Promise<void>;
    updateType: (type: EventType) => Promise<void>;
    deleteType: (id: string) => Promise<void>;
    assignTypeToTitle: (title: string, typeId: string) => Promise<void>;
    unassignType: (title: string) => Promise<void>;
    setDifficulty: (title: string, level: number) => Promise<void>;
    addRange: (range: Omit<TimeRangeDefinition, 'id' | 'isEnabled'>) => Promise<void>;
    updateRange: (id: string, updates: Partial<Omit<TimeRangeDefinition, 'id'>>) => Promise<void>;
    deleteRange: (id: string) => Promise<void>;
    toggleRange: (id: string) => Promise<void>;
    toggleEventFlag: (title: string, flag: 'isEnglish' | 'movable' | 'skippable') => Promise<void>;
    updateLunchConfig: (config: { targetCalendarId?: string; defaultInvitee?: string }) => Promise<void>;
}

export const useEventTypesStore = create<EventTypesState>()(
    persist(
        (set, get) => ({
            eventTypes: [],
            assignments: {},
            difficulties: {},
            ranges: [],
            eventFlags: {},
            lunchConfig: {},
            isLoaded: false,

            loadConfig: async () => {
                const vaultUri = useSettingsStore.getState().vaultUri;
                if (!vaultUri) return;

                const config = await loadEventTypesFromVault(vaultUri);
                if (config) {
                    set({
                        eventTypes: config.types,
                        assignments: config.assignments,
                        difficulties: config.difficulties || {},
                        ranges: config.ranges || [],
                        eventFlags: config.eventFlags || {},
                        lunchConfig: config.lunchConfig || {},
                        isLoaded: true
                    });
                } else {
                    // No config exists yet, start fresh
                    set({ isLoaded: true });
                }
            },

            addType: async (type) => {
                const state = get();
                const newTypes = [...state.eventTypes, type];
                const newConfig: EventTypeConfig = {
                    types: newTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ eventTypes: newTypes });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            updateType: async (updatedType) => {
                const state = get();
                const newTypes = state.eventTypes.map(t =>
                    t.id === updatedType.id ? updatedType : t
                );
                const newConfig: EventTypeConfig = {
                    types: newTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ eventTypes: newTypes });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
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

                const newConfig: EventTypeConfig = {
                    types: newTypes,
                    assignments: newAssignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ eventTypes: newTypes, assignments: newAssignments });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            assignTypeToTitle: async (title, typeId) => {
                const state = get();
                const newAssignments = {
                    ...state.assignments,
                    [title]: typeId
                };

                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: newAssignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ assignments: newAssignments });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            unassignType: async (title) => {
                const state = get();
                const newAssignments = { ...state.assignments };
                delete newAssignments[title];

                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: newAssignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ assignments: newAssignments });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            setDifficulty: async (title, level) => {
                const state = get();
                const newDifficulties = {
                    ...state.difficulties,
                    [title]: level
                };

                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: newDifficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ difficulties: newDifficulties });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            addRange: async (range) => {
                const state = get();
                const newRange: TimeRangeDefinition = {
                    ...range,
                    id: Crypto.randomUUID(),
                    isEnabled: true
                };
                const newRanges = [...state.ranges, newRange];
                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: newRanges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ ranges: newRanges });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            updateRange: async (id, updates) => {
                const state = get();
                const newRanges = state.ranges.map(range =>
                    range.id === id ? { ...range, ...updates } : range
                );
                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: newRanges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ ranges: newRanges });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            deleteRange: async (id) => {
                const state = get();
                const newRanges = state.ranges.filter(range => range.id !== id);
                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: newRanges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ ranges: newRanges });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            toggleRange: async (id) => {
                const state = get();
                const newRanges = state.ranges.map(range =>
                    range.id === id ? { ...range, isEnabled: !range.isEnabled } : range
                );
                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: newRanges,
                    eventFlags: state.eventFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ ranges: newRanges });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            toggleEventFlag: async (title, flag) => {
                const state = get();
                const currentFlags = state.eventFlags[title] || {};
                const newFlags = {
                    ...state.eventFlags,
                    [title]: {
                        ...currentFlags,
                        [flag]: !currentFlags[flag]
                    }
                };

                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: newFlags,
                    lunchConfig: state.lunchConfig
                };

                set({ eventFlags: newFlags });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
            },

            updateLunchConfig: async (config) => {
                const state = get();
                const newConfig: EventTypeConfig = {
                    types: state.eventTypes,
                    assignments: state.assignments,
                    difficulties: state.difficulties,
                    ranges: state.ranges,
                    eventFlags: state.eventFlags,
                    lunchConfig: { ...state.lunchConfig, ...config }
                };

                set({ lunchConfig: newConfig.lunchConfig });

                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    await saveEventTypesToVault(newConfig, vaultUri);
                }
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
                lunchConfig: state.lunchConfig
            }), // Don't persist isLoaded
        }
    )
);
