import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventType, EventTypeConfig, loadEventTypesFromVault } from '../services/eventTypeService';
import { useSettingsStore } from './settings';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';
import * as Crypto from 'expo-crypto';

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

            loadConfig: async () => {
                // If we already have types, assume loaded (from persistence or sync)
                const state = get();
                if (state.eventTypes.length > 0) {
                     set({ isLoaded: true });
                     return;
                }

                // If empty, try loading from Vault (Migration/Initial setup)
                const vaultUri = useSettingsStore.getState().vaultUri;
                if (vaultUri) {
                    try {
                        const legacyConfig = await loadEventTypesFromVault(vaultUri);
                        if (legacyConfig) {
                            console.log('[EventTypesStore] Migrating legacy config from Vault...');
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
                        }
                    } catch (e) {
                         console.error('[EventTypesStore] Failed to load from vault:', e);
                    }
                }

                // Ensure "Walk" range exists (default if missing)
                // Re-get state as it might have changed
                const currentState = get();
                if (!currentState.ranges.some(r => r.title === 'Walk')) {
                    console.log('[EventTypesStore] Creating default Walk range');
                    await currentState.addRange({
                        title: 'Walk',
                        start: { hour: 10, minute: 0 },
                        end: { hour: 19, minute: 0 },
                        days: [1, 2, 3, 4, 5], // Mon-Fri
                        color: '#10b981',
                        isWork: false,
                        isVisible: false
                    } as any);
                }

                set({ isLoaded: true });
            },

            addType: async (type) => {
                const state = get();
                const newTypes = [...state.eventTypes, type];
                set({ eventTypes: newTypes });
            },

            updateType: async (updatedType) => {
                const state = get();
                const newTypes = state.eventTypes.map(t =>
                    t.id === updatedType.id ? updatedType : t
                );
                set({ eventTypes: newTypes });
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
            },

            assignTypeToTitle: async (title, typeId) => {
                if (!title) return;
                const state = get();
                const newAssignments = {
                    ...state.assignments,
                    [title]: typeId
                };
                set({ assignments: newAssignments });
            },

            unassignType: async (title) => {
                if (!title) return;
                const state = get();
                const newAssignments = { ...state.assignments };
                delete newAssignments[title];
                set({ assignments: newAssignments });
            },

            setDifficulty: async (title, level) => {
                if (!title) return;
                const state = get();
                const newDifficulties = {
                    ...state.difficulties,
                    [title]: level
                };
                set({ difficulties: newDifficulties });
            },

            setEventIcon: async (title, icon) => {
                if (!title) return;
                const state = get();
                const newEventIcons = {
                    ...state.eventIcons,
                    [title]: icon
                };
                set({ eventIcons: newEventIcons });
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
            },

            updateRange: async (id, updates) => {
                const state = get();
                const newRanges = state.ranges.map(range =>
                    range.id === id ? { ...range, ...updates } : range
                );
                set({ ranges: newRanges });
            },

            deleteRange: async (id) => {
                const state = get();
                const newRanges = state.ranges.filter(range => range.id !== id);
                set({ ranges: newRanges });
            },

            toggleRange: async (id) => {
                const state = get();
                const newRanges = state.ranges.map(range =>
                    range.id === id ? { ...range, isEnabled: !range.isEnabled } : range
                );
                set({ ranges: newRanges });
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
            },

            updateLunchConfig: async (config) => {
                const state = get();
                set({ lunchConfig: { ...state.lunchConfig, ...config } });
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
