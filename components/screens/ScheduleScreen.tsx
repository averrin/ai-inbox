import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, RefreshControl, Platform, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar as BigCalendar, CalendarRef } from '../ui/calendar';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { useEventTypesStore } from '../../store/eventTypes';
import { getCalendarEvents, ensureCalendarPermissions } from '../../services/calendarService';
import { EventContextModal } from '../EventContextModal';
import { DateRuler } from '../DateRuler';
import * as Calendar from 'expo-calendar';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { useReminderModal } from '../../utils/reminderModalContext';
import { ScheduleEvent } from '../ui/calendar/components/ScheduleEvent';
import { useTimeRangeEvents } from '../ui/calendar/hooks/useTimeRangeEvents';
import { calculateEventDifficulty } from '../../utils/difficultyUtils';
import { useLunchSuggestion } from '../ui/calendar/hooks/useLunchSuggestion';
import { LunchContextModal } from '../LunchContextModal';
import { calculateDayStatus, aggregateDayStats, DayBreakdown, DayStatusLevel } from '../../utils/difficultyUtils';
import { DayStatusMarker } from '../DayStatusMarker';
import { DaySummaryModal } from '../DaySummaryModal';
import { updateReminder, toLocalISOString, createStandaloneReminder, Reminder, formatRecurrenceForReminder } from '../../services/reminderService';
import { EventFormModal, EventSaveData, DeleteOptions } from '../EventFormModal';
import { TaskEditModal } from '../markdown/TaskEditModal';
import { TaskWithSource } from '../../store/tasks';
import { createCalendarEvent, getWritableCalendars, updateCalendarEvent, deleteCalendarEvent } from '../../services/calendarService';

import { getWeatherForecast, getWeatherIcon, WeatherData } from '../../services/weatherService';
import { useMoodStore } from '../../store/moodStore';
import { MoodEvaluationModal } from '../MoodEvaluationModal';
import { WeatherForecastModal } from '../WeatherForecastModal';
import { RecurrenceScopeModal } from '../RecurrenceScopeModal';


export default function ScheduleScreen() {
    const { vaultUri, visibleCalendarIds, timeFormat, cachedReminders, setCachedReminders, defaultCreateCalendarId, defaultOpenCalendarId, weatherLocation, hideDeclinedEvents, personalAccountId, workAccountId, contacts, calendarDefaultEventTypes, personalCalendarIds, workCalendarIds } = useSettingsStore();
    const { assignments, difficulties, eventTypes, eventFlags, eventIcons, ranges, loadConfig, completedEvents, toggleCompleted } = useEventTypesStore();
    const { moods } = useMoodStore();
    const { showReminder } = useReminderModal();
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const tabBarHeight = 62 + insets.bottom; // Tab bar height including safe area
    // Adjusted height accounting for tab bar
    const height = windowHeight - tabBarHeight;
    const [events, setEvents] = useState<any[]>([]);
    const [weatherData, setWeatherData] = useState<Record<string, WeatherData>>({});
    const [isEventsLoaded, setIsEventsLoaded] = useState(false);
    const [date, setDate] = useState(new Date());
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
    const [viewMode, setViewMode] = useState<'day' | '3days' | 'week'>('day');
    const [selectedEvent, setSelectedEvent] = useState<{ title: string, start: Date, end: Date, typeTag?: string, [key: string]: any } | null>(null);
    const [summaryModalVisible, setSummaryModalVisible] = useState(false);
    const [summaryData, setSummaryData] = useState<{ breakdown: DayBreakdown, status: any, date: Date } | null>(null);
    const [creatingEventDate, setCreatingEventDate] = useState<Date | null>(null);
    const [creatingEventType, setCreatingEventType] = useState<'event' | 'reminder' | 'alarm' | 'zone'>('event');
    const [editingEvent, setEditingEvent] = useState<any | null>(null);
    const [editingTask, setEditingTask] = useState<TaskWithSource | null>(null);
    const [moodModalVisible, setMoodModalVisible] = useState(false);
    const [weatherModalVisible, setWeatherModalVisible] = useState(false);
    const [moodDate, setMoodDate] = useState<Date>(new Date());
    
    // Recurrence Scope Modal State
    const [recurrenceModalVisible, setRecurrenceModalVisible] = useState(false);
    const [pendingEventDrop, setPendingEventDrop] = useState<{ event: any, newDate: Date, executeUpdate: (options?: any) => Promise<void> } | null>(null);

    const calendarRef = useRef<CalendarRef>(null);


    // Fetch Weather Effect
    useEffect(() => {
        const start = dayjs(date).startOf('week').subtract(1, 'week').toDate();
        const end = dayjs(date).endOf('week').add(1, 'week').toDate();

        getWeatherForecast(weatherLocation.lat, weatherLocation.lon, start, end)
            .then(data => {
                setWeatherData(prev => ({ ...prev, ...data }));
            });
    }, [date, weatherLocation]);


    // Load event types config on mount
    useEffect(() => {
        loadConfig();
    }, []);

    // Calculate initial scroll position to center the current time
    const initialScrollOffset = useMemo(() => {
        const now = dayjs();
        const totalMinutes = now.hour() * 60 + now.minute();
        const cellHeight = 50; // Default cell height in BigCalendar
        const viewportHeight = height - 100;
        const minutesVisible = (viewportHeight / cellHeight) * 60;
        return Math.max(0, totalMinutes - (minutesVisible / 2));
    }, [height]);

    const scrollOffset = useRef(initialScrollOffset);

    const changeDate = (newDate: Date) => {
        if (dayjs(newDate).isSame(date, 'day')) return;

        if (newDate > date) {
            setDirection('forward');
        } else {
            setDirection('backward');
        }
        setDate(newDate);
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y <= 0) return; // Prevent 0-offset reset race condition
        const minutes = (y / 50) * 60;
        scrollOffset.current = minutes;
    };

    const fetchEvents = useCallback(async () => {
        try {
            const startDate = dayjs(date).startOf(viewMode === 'week' ? 'week' : 'day').subtract(7, 'day').toDate();
            const endDate = dayjs(date).endOf(viewMode === 'week' ? 'week' : 'day').add(7, 'day').toDate();

            const safeCalendarIds = Array.isArray(visibleCalendarIds) ? visibleCalendarIds.filter(id => !!id) : [];

            if (safeCalendarIds.length === 0) {
                setEvents([]);
                setIsEventsLoaded(true);
                return;
            }

            console.log('[ScheduleScreen] Fetching events for calendars:', safeCalendarIds);

            const nativeEvents = await getCalendarEvents(safeCalendarIds, startDate, endDate);

            if (!nativeEvents) {
                console.warn('[ScheduleScreen] getCalendarEvents returned null/undefined');
                setEvents([]);
                return;
            }

            // Get calendar metadata for source checking
            const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const calDetailsMap = allCals.reduce((acc: any, c) => {
                acc[c.id] = { title: c.title, color: c.color, source: c.source?.name || c.source?.type };
                return acc;
            }, {});

            // Map native events to BigCalendar format
            const mappedEvents = nativeEvents.map(evt => {
                const attendees = (evt as any).attendees || [];
                const normalize = (e: string) => e?.toLowerCase().trim();
                const meEmails = [];
                if (personalAccountId) meEmails.push(personalAccountId);
                if (workAccountId) meEmails.push(workAccountId);
                
                const meSet = new Set(meEmails.map(normalize));
                const isMe = (email: string) => meSet.has(normalize(email));

                const uniqueAttendees = new Map();
                attendees.forEach((a: any) => {
                    if (a.email) {
                        const email = normalize(a.email);
                        // Ignore Google resource calendars (conference rooms)
                        if (email.endsWith('resource.calendar.google.com')) return;
                        uniqueAttendees.set(email, a);
                    }
                });

                const isPersonal = uniqueAttendees.size === 0 || Array.from(uniqueAttendees.keys()).every(email => isMe(email as string));

                let hasMe = false;
                uniqueAttendees.forEach((_, email) => {
                    if (isMe(email)) hasMe = true;
                });

                const currentUserRSVP = attendees.find((a: any) => isMe(a.email))?.status || 'accepted';

                let assignedTypeId = assignments[evt.title];
                if (!assignedTypeId && calendarDefaultEventTypes && calendarDefaultEventTypes[evt.calendarId]) {
                    assignedTypeId = calendarDefaultEventTypes[evt.calendarId];
                }

                if (!assignedTypeId) {
                    const count = uniqueAttendees.size;
                    if (count === 0 || (count === 1 && hasMe)) {
                        const personalType = eventTypes.find(t => t.title.toLowerCase() === 'personal');
                        if (personalType) assignedTypeId = personalType.id;
                    } else if (count === 2) {
                        let hasWife = false;
                        uniqueAttendees.forEach((_, email) => {
                            const contact = (contacts || []).find(c => normalize(c.email) === email);
                            if (contact?.isWife) hasWife = true;
                        });

                        if (hasMe && hasWife) {
                            const personalType = eventTypes.find(t => t.title.toLowerCase() === 'personal');
                            if (personalType) assignedTypeId = personalType.id;
                        } else {
                            const oneOnOneType = eventTypes.find(t => t.title === '1-1' || t.title === '1:1');
                            if (oneOnOneType) assignedTypeId = oneOnOneType.id;
                        }
                    }
                }

                const assignedType = assignedTypeId ? eventTypes.find(t => t.id === assignedTypeId) : null;
                const baseDifficulty = difficulties?.[evt.title] || 0;
                const flags = eventFlags?.[evt.title];
                const iconOverride = eventIcons?.[evt.title];
                const color = assignedType ? assignedType.color : ((evt as any).color || (evt as any).displayColor || 'rgba(79, 70, 229, 0.8)');

                const difficultyResult = calculateEventDifficulty(
                    { title: evt.title, start: new Date(evt.startDate), end: new Date(evt.endDate) },
                    baseDifficulty,
                    ranges,
                    flags
                );

                const mergedIds = (evt as any).ids || [evt.id];
                const calendarTitle = calDetailsMap[evt.calendarId]?.title || '';
                const sourceName = calDetailsMap[evt.calendarId]?.source || '';
                const uniqueSourceCalendars = Array.from(new Set([(evt as any).calendarTitle || evt.calendarId])).filter(Boolean);

                let isZone = false;
                let zoneColor = color;
                let displayTitle = evt.title;

                if (evt.title && evt.title.startsWith('[Zone] ')) {
                    isZone = true;
                    displayTitle = evt.title.substring(7); // Remove '[Zone] '
                    const notes = (evt as any).notes || (evt as any).description || '';
                    const colorMatch = notes.match(/\[color::(.*?)\]/);
                    if (colorMatch) {
                        zoneColor = colorMatch[1];
                    }
                }

                return {
                    title: displayTitle,
                    start: new Date(evt.startDate),
                    end: new Date(evt.endDate),
                    color: zoneColor,
                    type: isZone ? 'zone' : undefined,
                    originalEvent: {
                        ...evt,
                        ids: mergedIds,
                        source: { name: sourceName },
                        currentUserRSVP,
                        color: zoneColor
                    },
                    typeTag: isZone ? 'ZONE' : (assignedType ? assignedType.title : null),
                    difficulty: difficultyResult,
                    isEnglish: flags?.isEnglish,
                    movable: flags?.movable || isPersonal,
                    isPersonal,
                    isSkippable: flags?.skippable !== undefined ? flags.skippable : currentUserRSVP === 'tentative',
                    needPrep: flags?.needPrep,
                    completable: !!flags?.completable,
                    isRecurrent: !!evt.recurrenceRule,
                    hasRSVPNo: currentUserRSVP === 'declined',
                    hideBadges: assignedType?.hideBadges,
                    isInverted: assignedType?.isInverted,
                    icon: iconOverride || assignedType?.icon,
                    allDay: evt.allDay
                };
            }).filter(evt => {
                if (hideDeclinedEvents && evt.hasRSVPNo) return false;
                return true;
            });

            // Map reminders to BigCalendar format (markers)
            const mappedReminders = (cachedReminders || [])
                .filter((r: any) => r.reminderTime)
                .map((r: any) => ({
                    title: r.title || r.fileName?.replace('.md', '') || 'Untitled Reminder',
                    start: new Date(r.reminderTime),
                    end: new Date(r.reminderTime),
                    color: r.alarm ? '#ef4444' : '#f59e0b',
                    originalEvent: r,
                    type: 'marker' as const,
                    difficulty: undefined,
                    typeTag: 'REMINDER',
                    movable: true
                }));

            const combinedEvents = [...mappedEvents, ...mappedReminders];

            // Add Zones for All-Day Events
            const allDayZones = mappedEvents
                .filter(e => e.allDay)
                .map(e => ({
                    ...e,
                    type: 'zone',
                    allDay: false,
                    color: (e.color || 'rgba(79, 70, 229, 0.8)').replace(/[\d.]+\)$/, '0.03)'),
                    start: dayjs(e.start).startOf('day').toDate(),
                    end: dayjs(e.end).endOf('day').toDate(),
                    title: `Zone: ${e.title}`,
                    borderWidth: 0
                }));

            const finalEvents = [...combinedEvents, ...allDayZones];

            setEvents(finalEvents);
            setIsEventsLoaded(true);
        } catch (e) {
            console.error("[ScheduleScreen] Critical error in fetchEvents:", e);
            setIsEventsLoaded(true);
        }
    }, [visibleCalendarIds, date, viewMode, assignments, eventTypes, difficulties, eventFlags, eventIcons, ranges, cachedReminders, defaultOpenCalendarId, hideDeclinedEvents, personalAccountId, workAccountId, contacts, calendarDefaultEventTypes]);

    const handleQuickAction = useCallback((action: 'event' | 'reminder' | 'zone', date: Date) => {
        if (action === 'reminder') {
            setCreatingEventType('reminder');
            setCreatingEventDate(date);
        } else if (action === 'event') {
            setCreatingEventType('event');
            setCreatingEventDate(date);
        } else if (action === 'zone') {
            setCreatingEventType('zone');
            setCreatingEventDate(date);
        }
    }, [setCreatingEventDate, setCreatingEventType]);

    const handleDeleteEvent = async (options: DeleteOptions) => {
        // Reminder Deletion
        if (editingEvent?.typeTag === 'REMINDER' || editingEvent?.originalEvent?.fileUri) {
             const reminder = editingEvent.originalEvent;
             const targetUri = reminder.fileUri;

             // Close Modal
             setCreatingEventDate(null);
             setEditingEvent(null);

             // Optimistic Delete
             setCachedReminders(cachedReminders.filter((r: any) => r.fileUri !== targetUri));
             setEvents(prev => prev.filter(e => e.originalEvent?.fileUri !== targetUri));

             if (options.deleteFile) {
                 // Delete note file
                 try {
                     await FileSystem.deleteAsync(targetUri, { idempotent: true });
                 } catch (e) {
                     console.error("Failed to delete note file:", e);
                     alert("Failed to delete note");
                     fetchEvents();
                 }
             } else {
                 // Delete reminder only
                 try {
                     await updateReminder(targetUri, null);
                 } catch (e) {
                     console.error("Failed to delete reminder:", e);
                     alert("Failed to delete reminder");
                     fetchEvents();
                 }
             }
             return;
        }

        // Calendar Event Deletion
        if (!editingEvent) return;
        const originalId = editingEvent.originalEvent?.id;

        // Close modal immediately
        setCreatingEventDate(null);
        setEditingEvent(null);

        // Optimistic delete
        setEvents(prev => prev.filter(e => e.originalEvent?.id !== originalId));

        try {
            // If editing a recurring instance, we might have originalId pointing to master
            const targetId = editingEvent.originalEvent?.originalId || originalId;
            const instanceStartDate = editingEvent.originalEvent?.startDate;

            const apiOptions: any = {};
            const scope = options.scope;

            if (scope === 'this') {
                apiOptions.instanceStartDate = instanceStartDate ? new Date(instanceStartDate) : undefined;
            } else if (scope === 'future') {
                apiOptions.instanceStartDate = instanceStartDate ? new Date(instanceStartDate) : undefined;
                apiOptions.futureEvents = true;
            }
            // scope === 'all' -> no options (targets master)

            await deleteCalendarEvent(targetId, apiOptions);

            setTimeout(() => {
                fetchEvents();
            }, 500);
        } catch (e) {
            console.error("Failed to delete event", e);
            alert('Failed to delete event');
            fetchEvents();
        }
    };

    const handleSaveEvent = (data: EventSaveData) => {
        // 1. Close modal immediately
        setCreatingEventDate(null);
        setEditingEvent(null);

        // --- REMINDER / ALARM LOGIC ---
        if (data.type === 'reminder' || data.type === 'alarm') {
             // Handle Reminder Save
             const reminderTime = data.startDate.toISOString();
             const recurrenceStr = formatRecurrenceForReminder(data.recurrenceRule);
             const content = data.content;

             // Check if it's an update
             if (editingEvent) {
                 const originalReminder = editingEvent.originalEvent;
                 const targetUri = originalReminder.fileUri;
                 const isNew = originalReminder.isNew; // if it was a temp one (though temp usually don't have fileUri yet, unless created optimistically)

                 // Optimistic Update (Cache & Events)
                 const updatedReminder = {
                     ...originalReminder,
                     reminderTime,
                     recurrenceRule: recurrenceStr,
                     alarm: data.alarm,
                     persistent: data.persistent,
                     title: data.title,
                     content: content
                 };

                 // Cache update
                 if (isNew) {
                     setCachedReminders([...cachedReminders, updatedReminder]);
                 } else {
                     const newCache = cachedReminders.map((r: any) =>
                         r.fileUri === targetUri ? updatedReminder : r
                     );
                     setCachedReminders(newCache);
                 }

                 // Events state update
                 const tempEvent = {
                    title: data.title || (isNew ? 'Reminder' : 'Untitled'),
                    start: data.startDate,
                    end: data.startDate,
                    color: data.alarm ? '#ef4444' : '#f59e0b',
                    type: 'marker',
                    originalEvent: updatedReminder,
                    typeTag: 'REMINDER'
                };

                if (isNew) {
                    setEvents([...events, tempEvent]);
                } else {
                    const newEvents = events.map(e => {
                        if (e.originalEvent && e.originalEvent.fileUri === targetUri) {
                            return {
                                ...e,
                                ...tempEvent,
                                title: data.title || e.title
                            };
                        }
                        return e;
                    });
                    setEvents(newEvents);
                }

                // Async Persistence
                (async () => {
                    try {
                        if (isNew) {
                            const result = await createStandaloneReminder(
                                reminderTime,
                                data.title,
                                recurrenceStr,
                                data.alarm,
                                data.persistent,
                                {},
                                [],
                                undefined,
                                content
                            );
                            if (result) {
                                // Fixup cache with real URI
                                const { cachedReminders, setCachedReminders } = useSettingsStore.getState();
                                const updatedCache = cachedReminders.map((r: any) => {
                                    if (r.fileUri === targetUri) { // targetUri was 'temp-...' likely
                                        return { ...r, fileUri: result.uri, isNew: false, fileName: result.fileName };
                                    }
                                    return r;
                                });
                                setCachedReminders(updatedCache);
                                fetchEvents(); // Refresh to be safe
                            }
                        } else {
                             await updateReminder(
                                targetUri!,
                                reminderTime,
                                recurrenceStr,
                                data.alarm,
                                data.persistent,
                                data.title,
                                content
                            );
                        }
                    } catch (e) {
                        console.error("Failed to save reminder:", e);
                    }
                })();

             } else {
                 // Create New Reminder
                 // Optimistic
                 const tempUri = `temp-${Date.now()}`;
                 const tempReminder = {
                     fileUri: tempUri,
                     title: data.title,
                     reminderTime,
                     recurrenceRule: recurrenceStr,
                     alarm: data.alarm,
                     persistent: data.persistent,
                     content: content,
                     isNew: true
                 };

                 setCachedReminders([...cachedReminders, tempReminder]);

                 const tempEvent = {
                     title: data.title,
                     start: data.startDate,
                     end: data.startDate,
                     color: data.alarm ? '#ef4444' : '#f59e0b',
                     type: 'marker',
                     originalEvent: tempReminder,
                     typeTag: 'REMINDER'
                 };
                 setEvents([...events, tempEvent]);

                 (async () => {
                     try {
                        const result = await createStandaloneReminder(
                            reminderTime,
                            data.title,
                            recurrenceStr,
                            data.alarm,
                            data.persistent,
                            {},
                            [],
                            undefined,
                            content
                        );
                        if (result) {
                            // Fixup cache
                            const { cachedReminders, setCachedReminders } = useSettingsStore.getState();
                            const updatedCache = cachedReminders.map((r: any) => {
                                if (r.fileUri === tempUri) {
                                    return { ...r, fileUri: result.uri, isNew: false, fileName: result.fileName };
                                }
                                return r;
                            });
                            setCachedReminders(updatedCache);
                            fetchEvents();
                        }
                     } catch (e) {
                         console.error("Failed to create reminder:", e);
                     }
                 })();
             }
             return;
        }

        // --- CALENDAR EVENT LOGIC ---

        // 2. Handle Edit
        if (editingEvent) {
            const originalId = editingEvent.originalEvent?.id;

            // Prevent editing optimistic events without an ID
            if (!originalId) {
                alert("This event is still syncing. Please try again in a moment.");
                fetchEvents();
                return;
            }

            // Optimistic Update (Simple replace in events array for immediate feedback)
            const updatedEvent = {
                ...editingEvent,
                title: data.title,
                start: data.startDate,
                end: data.endDate,
                // recurrence logic for visual?
            };

            // Note: complex optimistic update for recurrence/merges is hard, better to rely on fetch
            // But we can update the single event item in state
            setEvents(prev => prev.map(e =>
                (e.originalEvent?.id === originalId) ? updatedEvent : e
            ));

            (async () => {
                try {
                    // On Android, to update a specific instance, we often need the Master ID and the instance start date.
                    // If 'originalId' is present (meaning this is an instance of a recurring event), use it.
                    // Otherwise fall back to 'id'.
                    const targetId = editingEvent.originalEvent?.originalId || originalId;

                    // Ensure instanceStartDate is a Date object for correct formatting
                    const rawStartDate = editingEvent.originalEvent?.startDate;
                    const instanceStartDate = rawStartDate ? new Date(rawStartDate) : undefined;

                    let finalTitle = data.title;
                    if (editingEvent.type === 'zone' && !finalTitle.startsWith('[Zone] ')) {
                        finalTitle = `[Zone] ${finalTitle}`;
                    }
                    
                    // Handle Zone Color and Non-Free Update
                    // We need to pass the content with the color/nonFree tags to the update function
                    let finalContent = editingEvent.originalEvent?.content;
                    if (data.type === 'zone') {
                         let baseContent = (finalContent || '').replace(/\[color::.*?\]/g, '').replace(/\[nonFree::.*?\]/g, '').trim();
                         
                         if (data.color) {
                             baseContent += `\n[color::${data.color}]`;
                         }
                         if (data.isNonFree) {
                             baseContent += `\n[nonFree::true]`;
                         }
                         
                         finalContent = baseContent;
                    }

                    await updateCalendarEvent(targetId, {
                       title: finalTitle,
                       startDate: data.startDate,
                       endDate: data.endDate,
                       allDay: data.allDay,
                       isWork: data.isWork,
                       recurrenceRule: data.recurrenceRule ? {
                           ...data.recurrenceRule,
                           frequency: (data.recurrenceRule.frequency as any)
                       } : undefined,
                       editScope: data.editScope,
                       instanceStartDate: instanceStartDate,
                       content: finalContent // Pass updated content
                    });

                    // Re-sync
                   setTimeout(() => {
                       fetchEvents();
                   }, 500);
                } catch (e) {
                    console.error("Failed to update event", e);
                    alert('Failed to update event');
                    fetchEvents(); // Revert
                }
            })();
            return;
        }

        // 3. Handle Create
        let finalTitle = data.title;
        let finalContent = undefined;
        let internalMarkerType: 'event' | 'zone' = 'event';
        let optimisticColor = '#818cf8'; // Default blue

        if (data.type === 'zone') {
             finalTitle = `[Zone] ${data.title}`;
             
             let baseContent = (data.content || '').replace(/\[color::.*?\]/g, '').replace(/\[nonFree::.*?\]/g, '').trim();
             
             if (data.color) {
                 baseContent += `\n[color::${data.color}]`;
                 optimisticColor = data.color;
             } else {
                 optimisticColor = 'rgba(234, 179, 8, 0.2)';
             }
             
             if (data.isNonFree) {
                 baseContent += `\n[nonFree::true]`;
             }
             
             finalContent = baseContent;
             internalMarkerType = 'zone';
        }

        // Optimistic Update
        const tempEvent = {
            title: data.title,
            start: data.startDate,
            end: data.endDate,
            color: optimisticColor,
            type: internalMarkerType,
            typeTag: data.type === 'zone' ? 'ZONE' : undefined,
            originalEvent: {
                title: finalTitle,
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString(),
                color: optimisticColor
            }
        };

        // Add to local state immediately
        setEvents(prev => [...prev, tempEvent]);

        // Background Async Creation
        (async () => {
            try {
                // Better calendar selection logic (prioritize writable)
                const calendars = await getWritableCalendars();
                let targetCalendar;

                // Priority 1: User Default for Create
                if (defaultCreateCalendarId) {
                    targetCalendar = calendars.find(c => c.id === defaultCreateCalendarId && c.allowsModifications);
                }

                // Priority 2: Explicit Writable
                if (!targetCalendar) {
                    targetCalendar = calendars.find(c => c.allowsModifications);
                }

                // Priority 3: First Visible (if writable)
                if (!targetCalendar && visibleCalendarIds.length > 0) {
                    targetCalendar = calendars.find(c => c.id === visibleCalendarIds[0] && c.allowsModifications);
                }

                // Priority 4: Fallback to first available
                if (!targetCalendar && calendars.length > 0) {
                    targetCalendar = calendars[0];
                }

                if (!targetCalendar) {
                    console.error('[ScheduleScreen] No suitable calendar found to create event.');
                    alert('No suitable calendar found to create event.');
                    fetchEvents(); // Revert
                    return;
                }

                const eventPayload: any = {
                    title: finalTitle,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    allDay: data.allDay,
                    description: finalContent,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    isWork: data.isWork, // calendarService will use this for auto-invites
                    recurrenceRule: data.recurrenceRule
                };

                const newEventId = await createCalendarEvent(targetCalendar.id, eventPayload);

                // 4. Re-sync to get real ID and finalized data
                setTimeout(() => {
                    fetchEvents();
                }, 500); // Small delay to ensure native calendar has updated
            } catch (e) {
                console.error("[ScheduleScreen] Failed to create event:", e);
                alert('Failed to create event. Check logs.');
                fetchEvents(); // Revert optimistic update
            }
        })();
    };

    useFocusEffect(
        useCallback(() => {
            fetchEvents();
        }, [fetchEvents])
    );

    // Calculate date range for the hook (using same week logic as fetchEvents)
    const weekStart = useMemo(() => dayjs(date).startOf('week').subtract(1, 'week'), [date]);
    const weekEnd = useMemo(() => dayjs(date).endOf('week').add(1, 'week'), [date]);

    // Generate an array of days for the hook
    const hookDateRange = useMemo(() => {
        const days = [];
        let current = weekStart;
        while (current.isBefore(weekEnd)) {
            days.push(current);
            current = current.add(1, 'day');
        }
        return days;
    }, [weekStart, weekEnd]);

    const timeRangeEvents = useTimeRangeEvents(hookDateRange);

    const focusRanges = useMemo(() => {
        return detectFocusRanges(events);
    }, [events]);

    const { lunchEvents, dayDifficulties: lunchDifficulties } = useLunchSuggestion(events, hookDateRange);

    const dayStatuses = useMemo(() => {
        const map: Record<string, DayStatusLevel> = {};
        const eventsByDay: Record<string, any[]> = {};

        // Group events by day
        events.forEach(e => {
            if (e.type === 'marker') return;
            const dayStr = dayjs(e.start).format('YYYY-MM-DD');
            if (!eventsByDay[dayStr]) eventsByDay[dayStr] = [];
            eventsByDay[dayStr].push(e);
        });

        // Calculate status for each day found
        Object.keys(eventsByDay).forEach(dayStr => {
            const dailyEvents = eventsByDay[dayStr];
            const dayStats = aggregateDayStats(dailyEvents);

            // Add Lunch Penalty
            const lunchPenalty = lunchDifficulties[dayStr] || 0;
            if (lunchPenalty > 0) {
                dayStats.totalScore += lunchPenalty;
            }

            // Add Focus Bonus
            const dailyFocus = focusRanges.filter(f =>
                dayjs(f.start).format('YYYY-MM-DD') === dayStr
            );
            if (dailyFocus.length > 0) {
                dayStats.totalScore += dailyFocus.length;
            }

            map[dayStr] = calculateDayStatus(dayStats.totalScore, dayStats.deepWorkMinutes / 60);
        });

        // Handle days with only penalties (e.g. from lunch hook) but no events?
        // Usually lunch hook needs events to trigger, but let's cover if lunchDifficulties has keys not in events
        Object.keys(lunchDifficulties).forEach(dayStr => {
            if (!map[dayStr] && lunchDifficulties[dayStr] > 0) {
                map[dayStr] = calculateDayStatus(lunchDifficulties[dayStr], 0);
            }
        });

        return map;
    }, [events, lunchDifficulties, focusRanges]);

    const renderHeader = useCallback((headerProps: any) => {
        // headerProps.dateRange is an array of dayjs objects for the current view (page)
        // We use the first date in the range to represent the page's date in the DateRuler
        const pageDate = headerProps.dateRange[0];
        const pageDay = dayjs(pageDate);

        // Calculate score for this pageDate
        const dailyEvents = events.filter(e =>
            dayjs(e.start).isSame(pageDay, 'day') &&
            e.type !== 'marker'
        );

        // Calculate Day Stats using helper
        const dayStats = aggregateDayStats(dailyEvents);

        // Add Lunch Difficulty penalties (which come from hook, not events array directly yet)
        const dayStr = pageDay.format('YYYY-MM-DD');
        const lunchPenalty = lunchDifficulties[dayStr] || 0;

        if (lunchPenalty > 0) {
            dayStats.totalScore += lunchPenalty;
            dayStats.penalties.push({ reason: 'Lunch Issues', points: lunchPenalty, count: 1 });
        }

        // Calculate Focus Range Bonus (existing logic added length to score)
        // We should add this to stats
        const dailyFocus = focusRanges.filter(f =>
            dayjs(f.start).isSame(pageDay, 'day')
        );
        if (dailyFocus.length > 0) {
            dayStats.totalScore += dailyFocus.length;
            dayStats.penalties.push({ reason: 'Focus Range Bonus', points: dailyFocus.length, count: dailyFocus.length });
        }

        const status = calculateDayStatus(dayStats.totalScore, dayStats.deepWorkMinutes / 60);

        const hours = Math.floor(dayStats.deepWorkMinutes / 60);
        const mins = dayStats.deepWorkMinutes % 60;
        const deepWorkStr = `${hours}h ${mins}m`;

        const weather = weatherData[dayStr];

        // Mood Logic
        // Display mood and weather in the header
        const moodEntry = moods[dayStr];
        const moodColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];
        const moodColor = moodEntry ? moodColors[moodEntry.mood - 1] : undefined;

        // All Day Events for this day
        const dailyAllDayEvents = (headerProps.allDayEvents || []).filter((e: any) =>
            e.type !== 'zone' && // Filter out the grid zone markers from header
            dayjs(pageDate).isBetween(dayjs(e.start), dayjs(e.end), 'day', '[]')
        );

        return (
            <View className="bg-slate-900 border-b border-slate-800">
                <View className="px-4 py-2 flex-row justify-between items-center">
                    {/* Left: Mood Tracker and Weather */}
                    <View className="flex-row items-center gap-4">
                        <TouchableOpacity
                            onPress={() => {
                                setMoodDate(pageDate.toDate());
                                setMoodModalVisible(true);
                            }}
                            className="flex-row items-center"
                        >
                            {moodEntry ? (
                                <View className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: moodColor }} />
                            ) : (
                                <Ionicons name="add-circle-outline" size={20} color="#475569" />
                            )}
                        </TouchableOpacity>

                        {weather && (
                            <TouchableOpacity
                                onPress={() => setWeatherModalVisible(true)}
                                className="flex-row items-center gap-1"
                            >
                                <Ionicons name={weather.icon as any} size={16} color="#94a3b8" />
                                <Text className="text-slate-400 text-xs font-semibold">
                                    {Math.round(weather.maxTemp)}°C
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Right: Stats (Clickable for details) */}
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                            setSummaryData({ breakdown: dayStats, status, date: pageDate.toDate() });
                            setSummaryModalVisible(true);
                        }}
                        className="flex-row items-center gap-4"
                    >
                        <View className="flex-row items-center gap-2">
                            <DayStatusMarker status={status} />
                            {dayStats.deepWorkMinutes > 0 && (
                                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                                    Deep Work: <Text className="text-emerald-400 text-sm">{deepWorkStr}</Text>
                                </Text>
                            )}
                        </View>

                        <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            Day Score: <Text className="text-indigo-400 text-sm">{Math.round(dayStats.totalScore)}</Text>
                        </Text>

                        <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* All Day Events Row */}
                {dailyAllDayEvents.length > 0 && (
                    <View className="px-4 pb-2 flex-row flex-wrap gap-1.5">
                        {dailyAllDayEvents.map((evt: any, idx: number) => (
                            <TouchableOpacity
                                key={`${idx}-${evt.title}`}
                                onPress={() => setSelectedEvent({ ...evt })}
                                className="px-2 py-0.5 rounded-md flex-row items-center gap-1 border border-white/10"
                                style={{ backgroundColor: evt.color || '#4f46e5', opacity: 0.9 }}
                            >
                                <Ionicons name="calendar-outline" size={10} color="white" />
                                <Text className="text-white text-[10px] font-bold" numberOfLines={1}>
                                    {evt.title}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    }, [changeDate, events, focusRanges, lunchDifficulties, weatherData, moods]);

    const workRanges = useMemo(() => timeRangeEvents.filter((e: any) => e.isWork), [timeRangeEvents]);

    const freeTimeZones = useMemo(() => {
        if (!isEventsLoaded) return [];
        return detectFreeTimeZones(events, workRanges);
    }, [events, workRanges, isEventsLoaded]);



    const allEvents = useMemo(() => {
        return [...events, ...timeRangeEvents, ...focusRanges, ...freeTimeZones, ...lunchEvents];
    }, [events, timeRangeEvents, focusRanges, freeTimeZones, lunchEvents]);

    const eventCellStyle = useCallback((event: any) => {
        const now = dayjs();
        const eventEnd = dayjs(event.end);
        const isFinishedToday = now.isSame(event.start, 'day') && now.isAfter(eventEnd);

        // Compute isCompleted from store at render time
        const completedKey = `${event.title}::${dayjs(event.start).format('YYYY-MM-DD')}`;
        const isEventCompleted = event.completable && !!completedEvents[completedKey];

        // Completable: overdue (past today, not completed) => full opacity, red border + glow
        const isOverdueCompletable = event.completable && !isEventCompleted && isFinishedToday;
        // Completable: completed => dimmed
        const isCompletedEvent = isEventCompleted;

        const style: any = {
            backgroundColor: event.isInverted ? '#0f172a' : (event.color || '#4f46e5'),
            borderColor: event.isInverted ? (event.color || '#4f46e5') : '#eeeeee66',
            borderWidth: 1,
            borderRadius: 4,
            opacity: isCompletedEvent ? 0.35 : isOverdueCompletable ? 0.9 : (event.isSkippable || isFinishedToday) ? 0.45 : (event.isInverted ? 0.95 : 0.7),
            marginTop: -1
        };

        if (isOverdueCompletable) {
            style.borderColor = '#ef4444';
            style.borderWidth = 2;
            style.shadowColor = '#ef4444';
            style.shadowOffset = { width: 0, height: 4 };
            style.shadowOpacity = 0.8;
            style.shadowRadius = 12;
            style.elevation = 10;
            style.boxShadow = '0 4px 24px #ef444488';
        }

        // Highlight events outside work hours (red dashed border)
        if (!isOverdueCompletable && workRanges.length > 0 && !event.type && (event.difficulty?.total || 0) > 0) {
            const evtStart = dayjs(event.start);
            const evtEnd = dayjs(event.end);

            const isDuringWork = workRanges.some((range: any) => {
                const rangeStart = dayjs(range.start);
                const rangeEnd = dayjs(range.end);
                return evtStart.isBefore(rangeEnd) && evtEnd.isAfter(rangeStart);
            });

            if (!isDuringWork) {
                style.borderColor = 'red';
                style.borderWidth = 2;
                style.borderStyle = 'dashed';
            }
        }
        return style;
    }, [workRanges, completedEvents]);

    const handleEventDrop = async (event: any, newDate: Date) => {
        console.log('[ScheduleScreen] handleEventDrop initiated', { title: event.title, newDate });
        // Only allow dropping reminders or personal events
        const isReminder = event.typeTag === 'REMINDER' || !!event.originalEvent?.fileUri;
        const isPersonalEvent = event.isPersonal && event.originalEvent?.id;

        if (!isReminder && !isPersonalEvent) {
            alert('Only reminders and personal events can be rescheduled.');
            return;
        }

        if (isReminder) {
            const originalReminder = event.originalEvent;
            const newTimeStr = toLocalISOString(newDate);

            // Optimistic Update
            const updatedReminders = cachedReminders.map((r: any) => {
                if (r.fileUri === originalReminder.fileUri) {
                    return { ...r, reminderTime: newTimeStr };
                }
                return r;
            });
            setCachedReminders(updatedReminders);

            // Persist
            try {
                await updateReminder(
                    originalReminder.fileUri,
                    newTimeStr
                );
            } catch (e) {
                console.error('[ScheduleScreen] Failed to update reminder drop', e);
                alert('Failed to reschedule reminder.');
                fetchEvents();
            }
        } else {
            try {
                const duration = dayjs(event.end).diff(dayjs(event.start), 'millisecond');
                const newStart = newDate;
                const newEnd = new Date(newStart.getTime() + duration);

                // Optimistic Update in events list
                setEvents(prev => prev.map(e => {
                    const match = e.originalEvent?.id === event.originalEvent?.id && 
                                 (!e.start || new Date(e.start).getTime() === new Date(event.start).getTime());
                    if (match) {
                        return { ...e, start: newStart, end: newEnd };
                    }
                    return e;
                }));

                const rawIds = event.originalEvent?.ids || [event.originalEvent?.id];
                const ids = rawIds.filter((id: any) => id && (rawIds.length === 1 || String(id) !== String(event.originalEvent?.calendarId)));
                
                const executeUpdate = async (options: any = {}) => {
                    const isAndroid = Platform.OS === 'android';
                    
                    for (const id of ids) {
                        try {
                            const originalId = event.originalEvent?.originalId || String(id).split(':')[0];
                            const isSeriesUpdate = options.editScope === 'all' || options.editScope === 'future';
                            
                            // For a series update on Android, we should target the master ID.
                            // For 'all', we target master directly. For 'future', expo-calendar handles splitting.
                            let targetId = (isSeriesUpdate && originalId) ? originalId : id;
                            let finalOptions = { ...options };

                            // Android specific adjustment for 'future' updates if we have an instance ID
                            if (isAndroid && options.editScope === 'future' && String(targetId).includes(':')) {
                                targetId = String(targetId).split(':')[0];
                                // We don't need to delete anything from finalOptions here because calendarService 
                                // will process editScope into the correct native options.
                            }

                            await updateCalendarEvent(targetId, {
                                startDate: newStart,
                                endDate: newEnd,
                                title: event.title || event.originalEvent?.title || 'Event',
                                calendarId: event.originalEvent?.calendarId,
                                ...finalOptions
                            });
                        } catch (err) {
                            console.warn(`[ScheduleScreen] Failed to update event ID ${id}:`, err);
                        }
                    }
                    setTimeout(() => {
                        fetchEvents();
                    }, 500);
                };

                const isRecurrent = event.isRecurrent || !!event.originalEvent?.recurrenceRule || !!event.originalEvent?.originalId || !!event.originalEvent?.instanceStartDate;
                console.log('[ScheduleScreen] handleEventDrop detected recurrence:', isRecurrent, { 
                    isRecurrentField: event.isRecurrent,
                    hasRule: !!event.originalEvent?.recurrenceRule,
                    hasOriginalId: !!event.originalEvent?.originalId,
                    hasInstanceStart: !!event.originalEvent?.instanceStartDate
                });

                if (isRecurrent) {
                    setPendingEventDrop({ 
                        event, 
                        newDate, 
                        executeUpdate: (opts) => executeUpdate({ ...opts, instanceStartDate: new Date(event.start) }) 
                    });
                    setRecurrenceModalVisible(true);
                } else {
                    executeUpdate();
                }
            } catch (e) {
                console.error('[ScheduleScreen] Error in handleEventDrop Personal Path', e);
                alert('Failed to reschedule event.');
                fetchEvents();
            }
        }
    };

    return (
        <View className="flex-1 bg-slate-950">
            <SafeAreaView className="flex-1" edges={['left', 'right', 'bottom']}>
                <DateRuler
                    date={date}
                    onDateChange={changeDate}
                    onNext={() => calendarRef.current?.goNext()}
                    onPrev={() => calendarRef.current?.goPrev()}
                    onToday={() => calendarRef.current?.goToDate(new Date())}
                    dayStatuses={dayStatuses}
                    onSync={fetchEvents}
                />

                {/* Calendar View */}
                {visibleCalendarIds.length === 0 ? (
                    <View className="flex-1 justify-center items-center p-6">
                        <Ionicons name="calendar-outline" size={64} color="#334155" />
                        <Text className="text-slate-400 text-center mt-4">
                            No calendars selected.
                        </Text>
                        <Text className="text-slate-500 text-center mt-2 text-sm">
                            Go to Settings {'>'} Calendars to configure.
                        </Text>
                    </View>
                ) : (
                    <View className="flex-1 overflow-hidden">
                        {/* @ts-ignore - onScroll is monkey-patched */}
                        <BigCalendar
                            imperativeRef={calendarRef}
                            renderHeader={renderHeader}
                            events={allEvents}
                            height={height}
                            date={date}
                            mode={viewMode}
                            onEventDrop={handleEventDrop}
                            onSwipeEnd={(d) => {
                                if (dayjs(d).isSame(date, 'day')) return;
                                setDate(d);
                            }}
                            scrollOffsetMinutes={scrollOffset.current}
                            // onScroll={handleScroll}
                            theme={{
                                palette: {
                                    primary: {
                                        main: '#818cf8',
                                        contrastText: '#fff',
                                    },
                                    gray: {
                                        100: '#334155',
                                        200: '#1e293b',
                                        300: '#94a3b8',
                                        500: '#cbd5e1',
                                        800: '#f8fafc',
                                    },
                                },
                                typography: {
                                    xs: {
                                        fontSize: 14,
                                        fontWeight: '500',
                                    },
                                    sm: {
                                        fontSize: 17,
                                        fontWeight: '600',
                                    },
                                    xl: {
                                        fontSize: 26,
                                        fontWeight: 'bold',
                                    },
                                }
                            }}
                            eventCellStyle={eventCellStyle}
                            onPressEvent={(evt) => {
                                const event = evt as any;
                                if (event.type === 'marker') {
                                    setEditingEvent(event);
                                } else if (event.type === 'zone') {
                                    setEditingEvent(event);
                                } else {
                                    setSelectedEvent({ title: event.title, start: event.start, end: event.end, ...event }); // Spread all props to include color/typeTag
                                }
                            }}
                            calendarCellStyle={{ borderColor: '#334155', backgroundColor: '#0f172a' }}
                            bodyContainerStyle={{ backgroundColor: '#0f172a' }}
                            renderEvent={(evt, touchableOpacityProps) => (
                                <ScheduleEvent
                                    event={evt}
                                    touchableOpacityProps={touchableOpacityProps}
                                    timeFormat={timeFormat}
                                    onToggleCompleted={toggleCompleted}
                                />
                            )}
                            onQuickAction={handleQuickAction}
                        />
                    </View>
                )}



                {/* Context Menu Modal */}
                <EventContextModal
                    visible={!!selectedEvent && !selectedEvent?.typeTag?.includes('LUNCH_SUGGESTION')}
                    onClose={() => setSelectedEvent(null)}
                    onEdit={() => setEditingEvent(selectedEvent)}
                    onOpenTask={(task) => {
                        setSelectedEvent(null);
                        setEditingTask(task);
                    }}
                    event={selectedEvent}
                />

                <LunchContextModal
                    visible={!!selectedEvent && selectedEvent?.typeTag === 'LUNCH_SUGGESTION'}
                    onClose={() => setSelectedEvent(null)}
                    event={selectedEvent}
                    onEventCreated={fetchEvents}
                />

                <DaySummaryModal
                    visible={summaryModalVisible}
                    onClose={() => setSummaryModalVisible(false)}
                    breakdown={summaryData?.breakdown || null}
                    status={summaryData?.status || 'healthy'}
                    date={summaryData?.date || new Date()}
                />

                <RecurrenceScopeModal
                    visible={recurrenceModalVisible}
                    onClose={() => {
                        setRecurrenceModalVisible(false);
                        setPendingEventDrop(null);
                        fetchEvents(); // Revert optimistic move
                    }}
                    onSelect={(scope) => {
                        if (pendingEventDrop) {
                            pendingEventDrop.executeUpdate({ editScope: scope });
                            setRecurrenceModalVisible(false);
                            setPendingEventDrop(null);
                        }
                    }}
                    actionType="reschedule"
                />


                {(creatingEventDate || editingEvent) && (
                    <EventFormModal
                        visible={!!creatingEventDate || !!editingEvent}
                        initialDate={creatingEventDate || undefined}
                        initialEvent={editingEvent}
                        initialType={creatingEventType}
                        timeFormat={timeFormat}
                        onCancel={() => {
                            setCreatingEventDate(null);
                            setEditingEvent(null);
                        }}
                        onSave={handleSaveEvent}
                        onDelete={handleDeleteEvent}
                        onOpenTask={(task) => {
                            // Close event modal first
                            setEditingEvent(null);
                            setCreatingEventDate(null);
                            
                            // Navigation to task view
                            // In ScheduleScreen, we don't have TaskEditModal directly.
                            // However, we can use the reminder context or just alert for now 
                            // if we can't easily jump to the other screen's state.
                            // BUT wait, we can just open the task edit modal IF we add it here.
                            setEditingTask(task);
                        }}
                    />
                )}

                {editingTask && (
                    <TaskEditModal
                        visible={!!editingTask}
                        task={editingTask}
                        onSave={async (updatedTask) => {
                            const { TaskService } = await import('../../services/taskService');
                            if (vaultUri) {
                                await TaskService.syncTaskUpdate(vaultUri, editingTask, updatedTask);
                                setEditingTask(null);
                                fetchEvents(); // Refresh to catch changes
                            }
                        }}
                        onCancel={() => setEditingTask(null)}
                        onOpenEvent={(id) => {
                            setEditingTask(null);
                            // Calendar event editing is already handled by setEditingEvent
                            Calendar.getEventAsync(id).then(evt => {
                                if (evt) setEditingEvent(evt);
                            });
                        }}
                    />
                )}

                <MoodEvaluationModal
                    visible={moodModalVisible}
                    onClose={() => setMoodModalVisible(false)}
                    date={moodDate}
                />

                <WeatherForecastModal
                    visible={weatherModalVisible}
                    onClose={() => setWeatherModalVisible(false)}
                    weatherData={weatherData}
                    currentDate={date}
                />
            </SafeAreaView>
        </View>
    );
}

// Helper: cluster events for focus time
const detectFocusRanges = (allEvents: any[]) => {
    // 1. Filter events with difficulty > 0
    // And exclude ranges/markers if any are in 'events'
    const candidates = allEvents.filter(e =>
        (e.difficulty?.total > 0) &&
        !e.type // exclude internal types if any
    );

    // Group by day
    const byDay: Record<string, typeof candidates> = {};
    candidates.forEach(e => {
        const d = dayjs(e.start).format('YYYY-MM-DD');
        if (byDay[d]) {
            byDay[d].push(e);
        } else {
            byDay[d] = [e];
        }
    });

    const results: any[] = [];

    // Process each day
    Object.values(byDay).forEach(dayEvents => {
        // Sort
        dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Cluster
        let cluster: typeof candidates = [];

        const flush = () => {
            if (cluster.length > 0) {
                const start = cluster[0].start;
                // Find max end
                let end = cluster[0].end;
                cluster.forEach(c => { if (dayjs(c.end).isAfter(end)) end = c.end; });

                const duration = dayjs(end).diff(dayjs(start), 'minute');


                if (duration > 60) {
                    // Clamp to end of day to ensure single-day analysis
                    const startDayEnd = dayjs(start).endOf('day');
                    let finalEnd = end;
                    if (dayjs(end).isAfter(startDayEnd)) {
                        finalEnd = startDayEnd.toDate();
                    }

                    results.push({
                        title: 'Focus Time',
                        start,
                        end: finalEnd,
                        color: '#FF0000', // Bright red
                        type: 'range', // reuse existing range rendering logic
                        typeTag: 'DYNAMIC_FOCUS'
                    });
                }
            }
        };

        dayEvents.forEach(evt => {
            if (cluster.length === 0) {
                cluster.push(evt);
            } else {
                // Find effective end of the current cluster (max end time)
                let clusterEnd = dayjs(cluster[0].end);
                cluster.forEach(c => { if (dayjs(c.end).isAfter(clusterEnd)) clusterEnd = dayjs(c.end); });

                // Gap is start of new event minus end of cluster
                const gap = dayjs(evt.start).diff(clusterEnd, 'minute');

                if (gap <= 15) {
                    cluster.push(evt);
                } else {
                    flush();
                    cluster = [evt];
                }
            }
        });
        flush();
    });

    return results;
}

// Helper: detect free time zones (gaps > 60m between difficulty >= 1 events)
// Restricted to within provided workRanges
const detectFreeTimeZones = (allEvents: any[], workRanges: any[] = []) => {
    // 1. Filter events with difficulty >= 1 (Busy events)
    // Ignore internal types unless they are zones marked as non-free
    const busyEvents = allEvents.filter(e => {
        if (e.type === 'zone') {
            const content = e.originalEvent?.content || e.originalEvent?.notes || '';
            if (content.includes('[nonFree::true]')) return true;
        }
        return (e.difficulty?.total >= 1) && !e.type;
    });

    // Group busy events by day
    const byDay: Record<string, typeof busyEvents> = {};
    busyEvents.forEach(e => {
        const d = dayjs(e.start).format('YYYY-MM-DD');
        if (byDay[d]) {
            byDay[d].push(e);
        } else {
            byDay[d] = [e];
        }
    });

    // Group work ranges by day
    const rangesByDay: Record<string, any[]> = {};
    workRanges.forEach(r => {
        const d = dayjs(r.start).format('YYYY-MM-DD');
        if (rangesByDay[d]) {
            rangesByDay[d].push(r);
        } else {
            rangesByDay[d] = [r];
        }
    });

    // We process days that have Work Ranges
    const relevantDays = Object.keys(rangesByDay);
    const results: any[] = [];

    relevantDays.forEach(dayStr => {
        const dayEvents = byDay[dayStr] || []; // busy events for this day
        const dayRanges = rangesByDay[dayStr] || [];

        // Sort busy events
        dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

        dayRanges.forEach(range => {
            const rangeStart = dayjs(range.start);
            const rangeEnd = dayjs(range.end);

            // Filter events relevant to this range (overlap)
            const rangeEvents = dayEvents.filter(evt => {
                const eStart = dayjs(evt.start);
                const eEnd = dayjs(evt.end);
                return eStart.isBefore(rangeEnd) && eEnd.isAfter(rangeStart);
            });

            let currentPointer = rangeStart;

            rangeEvents.forEach(evt => {
                const evtStart = dayjs(evt.start);
                const evtEnd = dayjs(evt.end);

                // Gap between pointer and event start?
                if (evtStart.isAfter(currentPointer)) {
                    const duration = evtStart.diff(currentPointer, 'minute');
                    if (duration >= 60) {
                        results.push({
                            title: 'Free Time',
                            start: currentPointer.toDate(),
                            end: evtStart.toDate(),
                            color: 'rgba(200, 255, 200, 0.3)',
                            borderColor: 'rgba(100, 200, 100, 0.5)',
                            type: 'zone',
                            typeTag: 'FREE_TIME'
                        });
                    }
                }

                // Advance pointer to end of this event (if it pushes boundaries)
                if (evtEnd.isAfter(currentPointer)) {
                    currentPointer = evtEnd;
                }
            });

            // Final gap: From currentPointer to rangeEnd
            if (rangeEnd.isAfter(currentPointer)) {
                const duration = rangeEnd.diff(currentPointer, 'minute');
                if (duration >= 60) {
                    results.push({
                        title: 'Free Time',
                        start: currentPointer.toDate(),
                        end: rangeEnd.toDate(),
                        color: 'rgba(200, 255, 200, 0.3)',
                        borderColor: 'rgba(100, 200, 100, 0.5)',
                        type: 'zone',
                        typeTag: 'FREE_TIME'
                    });
                }
            }
        });
    });

    return results;
}
