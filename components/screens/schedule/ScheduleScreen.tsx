import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, RefreshControl, Platform, ActivityIndicator } from 'react-native';
import { serializeTaskLine } from '../../../utils/taskParser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseScreen } from '../BaseScreen';
import { HeaderAction } from '../../ui/IslandHeader';
import { Layout } from '../../ui/Layout';
import Toast from 'react-native-toast-message';
import { Calendar as BigCalendar, CalendarRef } from '../../ui/calendar';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../../store/settings';
import { useEventTypesStore } from '../../../store/eventTypes';
import { getCalendarEvents, ensureCalendarPermissions } from '../../../services/calendarService';
import { UnifiedSuggestionModal } from '../../UnifiedSuggestionModal';
import { DateRuler } from '../../DateRuler';
import * as Calendar from 'expo-calendar';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useReminderModal } from '../../../utils/reminderModalContext';
import { ScheduleEvent } from '../../ui/calendar/components/ScheduleEvent';
import { useTimeRangeEvents } from '../../ui/calendar/hooks/useTimeRangeEvents';
import { calculateEventDifficulty } from '../../../utils/difficultyUtils';
import { useLunchSuggestion } from '../../ui/calendar/hooks/useLunchSuggestion';
import { useWalkSuggestion } from '../../ui/calendar/hooks/useWalkSuggestion';
import { useScheduleAssistant } from '../../ui/calendar/hooks/useScheduleAssistant';
import { EventContextModal } from '../../EventContextModal';
import { AssistantSuggestionModal } from '../../AssistantSuggestionModal';
import { DaySummaryModal } from '../../DaySummaryModal';
import { calculateDayStatus, aggregateDayStats, DayBreakdown, DayStatusLevel } from '../../../utils/difficultyUtils';
import { DayStatusMarker } from '../../DayStatusMarker';
import { updateReminder, toLocalISOString, createStandaloneReminder, Reminder, formatRecurrenceForReminder } from '../../../services/reminderService';
import { EventFormModal, EventSaveData, DeleteOptions } from '../../EventFormModal';
import { TaskEditModal } from '../../markdown/TaskEditModal';
import { TaskWithSource, useTasksStore } from '../../../store/tasks';
import { createCalendarEvent, getWritableCalendars, updateCalendarEvent, deleteCalendarEvent } from '../../../services/calendarService';

import { getWeatherForecast, getWeatherIcon, WeatherData } from '../../../services/weatherService';
import { updateUserLocation } from '../../../utils/locationUtils';
import { useMoodStore } from '../../../store/moodStore';
import { MoodEvaluationModal } from '../../MoodEvaluationModal';
import { WeatherForecastModal } from '../../WeatherForecastModal';
import { RecurrenceScopeModal } from '../../RecurrenceScopeModal';
import { DragDropProvider } from '../../DragDropContext';
import { DragOverlay } from '../../DragOverlay';
import { TodaysTasksPanel } from '../TodaysTasksPanel';
import { RelationService } from '../../../services/relationService';
import { useRelationsStore } from '../../../store/relations';
import { TaskService } from '../../../services/taskService';
import { useFab } from '../../../hooks/useFab';
import { useWeatherStore } from '../../../store/weatherStore';
import { WeatherHourGuide } from '../../WeatherHourGuide';
import { Colors, Palette } from '../../ui/design-tokens';
import { showAlert, showError } from '../../../utils/alert';
import { getEventCellStyle, detectFocusRanges, detectFreeTimeZones } from './utils/scheduleUtils';
import { ScheduleHeader } from './components/ScheduleHeader';
import { NoCalendarsView } from './components/NoCalendarsView';
import { useScheduleActions } from './hooks/useScheduleActions';

export const ScheduleScreen = () => {
    const { vaultUri, visibleCalendarIds, timeFormat, cachedReminders, setCachedReminders, defaultCreateCalendarId, defaultOpenCalendarId, weatherLocation, hideDeclinedEvents, personalAccountId, workAccountId, contacts, calendarDefaultEventTypes, personalCalendarIds, workCalendarIds, useCurrentLocation, apiKey: geminiApiKey } = useSettingsStore();
    const { assignments, difficulties, eventTypes, eventFlags, eventIcons, ranges, loadConfig, completedEvents, toggleCompleted } = useEventTypesStore();
    const { moods } = useMoodStore();
    const { showReminder } = useReminderModal();
    const navigation = useNavigation();
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const tabBarHeight = 62 + insets.bottom; // Tab bar height including safe area
    // Adjusted height accounting for tab bar
    const height = windowHeight;
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
    const [pendingLinkTask, setPendingLinkTask] = useState<TaskWithSource | null>(null);
    const [moodModalVisible, setMoodModalVisible] = useState(false);
    const [weatherModalVisible, setWeatherModalVisible] = useState(false);
    const [moodDate, setMoodDate] = useState<Date>(new Date());

    // Recurrence Scope Modal State
    const [recurrenceModalVisible, setRecurrenceModalVisible] = useState(false);
    const [showAdditionalCalendars, setShowAdditionalCalendars] = useState(true);
    const [pendingEventDrop, setPendingEventDrop] = useState<{ event: any, newDate: Date, executeUpdate: (options?: any) => Promise<void> } | null>(null);

    const calendarRef = useRef<CalendarRef>(null);
    const gcTimeoutRef = useRef<any>(null);
    const fetchIdRef = useRef(0);



    // Fetch Weather Effect
    const updateWeatherData = useWeatherStore(s => s.updateWeatherData);
    useEffect(() => {
        const start = dayjs(date).startOf('week').subtract(1, 'week').toDate();
        const end = dayjs(date).endOf('week').add(1, 'week').toDate();

        getWeatherForecast(weatherLocation.lat, weatherLocation.lon, start, end)
            .then(data => {
                setWeatherData(prev => ({ ...prev, ...data }));
                updateWeatherData(data);
            });
    }, [date, weatherLocation, updateWeatherData]);


    // Load event types config on mount
    useEffect(() => {
        const init = async () => {
            await loadConfig();
            const { vaultUri } = useSettingsStore.getState();
            const { tasksRoot } = useTasksStore.getState();
            if (vaultUri && tasksRoot) {
                console.log('[ScheduleScreen] Scanning relations on mount...');
                await RelationService.scanRelations(vaultUri, tasksRoot);
            }
        };
        init();
    }, []);

    // Listen for tab press to reset to today
    useEffect(() => {
        const unsubscribe = navigation.addListener('tabPress' as any, (e: any) => {
            const now = new Date();
            setDate(now);
            calendarRef.current?.goToDate(now);
        });

        return unsubscribe;
    }, [navigation]);

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

    // Trigger fetch when date or calendars change while focused
    useEffect(() => {
        fetchEvents();
    }, [date, visibleCalendarIds, viewMode]);

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
        const currentId = ++fetchIdRef.current;
        // Keep existing events visible during fetch to avoid flashing
        try {
            const startDate = dayjs(date).startOf(viewMode === 'week' ? 'week' : 'day').subtract(7, 'day').toDate();
            const endDate = dayjs(date).endOf(viewMode === 'week' ? 'week' : 'day').add(7, 'day').toDate();

            const safeCalendarIds = Array.isArray(visibleCalendarIds) ? visibleCalendarIds.filter(id => !!id) : [];

            if (safeCalendarIds.length === 0) {
                if (currentId !== fetchIdRef.current) return;
                setEvents([]);
                setIsEventsLoaded(true);
                return;
            }

            // console.log('[ScheduleScreen] Fetching events for calendars:', safeCalendarIds);

            const nativeEvents = await getCalendarEvents(safeCalendarIds, startDate, endDate);

            if (currentId !== fetchIdRef.current) return;

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
                const calendarTitle = calDetailsMap[evt.calendarId]?.title || '';
                const sourceName = calDetailsMap[evt.calendarId]?.source || '';

                const normalize = (e: string) => e?.toLowerCase().trim();
                const meEmails = [];
                if (personalAccountId) meEmails.push(personalAccountId);
                if (workAccountId) meEmails.push(workAccountId);
                if (sourceName && sourceName.includes('@')) meEmails.push(sourceName);
                if (calendarTitle && calendarTitle.includes('@')) meEmails.push(calendarTitle);

                const meSet = new Set(meEmails.map(normalize));
                const isMe = (email: string) => meSet.has(normalize(email));

                // Logic to check if all other human attendees declined
                const otherHumanAttendees = attendees.filter((a: any) => {
                    const email = normalize(a.email || '');
                    if (!email) return false;

                    // Filter out Me
                    if (a.isCurrentUser || isMe(email)) return false;

                    // Filter out resources
                    if (email.endsWith('resource.calendar.google.com')) return false;

                    return true;
                });

                const allOthersDeclined = otherHumanAttendees.length > 0 && otherHumanAttendees.every((a: any) => a.status === 'declined');

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

                // Find current user RSVP with fallback logic
                const currentUserRSVP = attendees.find((a: any) =>
                    a.isCurrentUser || isMe(a.email)
                )?.status || 'accepted';

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
                    movable: flags?.movable !== undefined ? flags.movable : isPersonal,
                    isPersonal,
                    isSkippable: flags?.skippable !== undefined ? flags.skippable : currentUserRSVP === 'tentative',
                    needPrep: flags?.needPrep,
                    completable: flags?.completable !== undefined ? flags.completable : (!!(evt as any).notes?.includes('[completable:: true]') || !!(evt as any).description?.includes('[completable:: true]')),
                    isRecurrent: !!evt.recurrenceRule,
                    hasRSVPNo: currentUserRSVP === 'declined',
                    allOthersDeclined,
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
            // Read from store at call time to avoid stale closure data
            const latestReminders = useSettingsStore.getState().cachedReminders;
            const mappedReminders = (latestReminders || [])
                .filter((r: any) => r.reminderTime)
                .map((r: any) => ({
                    title: r.title || r.fileName?.replace('.md', '') || 'Untitled Reminder',
                    start: new Date(r.reminderTime),
                    end: new Date(r.reminderTime),
                    color: r.alarm ? Colors.error : Palette[5],
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

            if (currentId !== fetchIdRef.current) return;

            setEvents(finalEvents);
            setIsEventsLoaded(true);

            // Trigger Garbage Collection for Phantom Events (Debounced)
            if (vaultUri) {
                if (gcTimeoutRef.current) clearTimeout(gcTimeoutRef.current);
                gcTimeoutRef.current = setTimeout(() => {
                    RelationService.cleanupPhantomEvents(vaultUri).catch(err =>
                        console.warn('[ScheduleScreen] Phantom Event GC failed', err)
                    );
                    gcTimeoutRef.current = null;
                }, 2000); // 2 second debounce to allow everything to settle
            }

        } catch (e) {
            if (currentId !== fetchIdRef.current) return;
            console.error("[ScheduleScreen] Critical error in fetchEvents:", e);
            setIsEventsLoaded(true);
        }
    }, [visibleCalendarIds, date, viewMode, assignments, eventTypes, difficulties, eventFlags, eventIcons, ranges, defaultOpenCalendarId, hideDeclinedEvents, personalAccountId, workAccountId, contacts, calendarDefaultEventTypes]);


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

    const handleTaskDrop = useCallback((dropDate: Date, task: any) => {
        setPendingLinkTask(task);
        setCreatingEventDate(dropDate);
        setCreatingEventType('event');
    }, []);

    const handleAddTask = useCallback(() => {
        const newTaskTemplate = {
            title: '',
            status: ' ',
            completed: false,
            properties: { date: dayjs(date).format('YYYY-MM-DD') },
            tags: [],
            indentation: '',
            bullet: '-',
            originalLine: ''
        };
        setEditingTask(newTaskTemplate as any);
    }, [date]);

    const handleFabPress = useCallback(() => {
        // Default FAB action on Schedule: Create Event at current time
        const now = new Date();
        // Round to next 30 min
        const minutes = now.getMinutes();
        const rounded = new Date(now);
        rounded.setMinutes(minutes > 30 ? 60 : 30);
        rounded.setSeconds(0);
        rounded.setMilliseconds(0);

        setCreatingEventDate(rounded);
        setCreatingEventType('event');
    }, []);

    useFab({
        onPress: handleFabPress,
        icon: 'add'
    });


    useFocusEffect(
        useCallback(() => {
            fetchEvents();
            if (useCurrentLocation) {
                updateUserLocation();
            }
        }, [fetchEvents, useCurrentLocation])
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

    const { walkEvent, dismiss: dismissWalk, refresh: refreshWalk, isLoading: isWalkLoading } = useWalkSuggestion({
        events,
        extraEvents: lunchEvents,
        selectedDate: date,
        weather: weatherData[dayjs(date).format('YYYY-MM-DD')]?.hourly || [],
        apiKey: geminiApiKey || ''
    });

    const { assistantEvents, generateSuggestions, acceptSuggestion, dismissSuggestion, isLoading: isAssistantLoading } = useScheduleAssistant(geminiApiKey || '');

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

    const workRanges = useMemo(() => timeRangeEvents.filter((e: any) => e.isWork), [timeRangeEvents]);

    // --- ACTIONS HOOK ---
    const {
        handleDeleteEvent,
        handleSaveEvent,
        handleEventDrop,
        handleToggleCompleted
    } = useScheduleActions({
        events,
        setEvents,
        fetchEvents,
        cachedReminders,
        setCachedReminders,
        vaultUri,
        completedEvents,
        toggleCompleted,
        setCreatingEventDate,
        setEditingEvent,
        setPendingLinkTask,
        setRecurrenceModalVisible,
        setPendingEventDrop,
        defaultCreateCalendarId,
        visibleCalendarIds,
        editingEvent,
        pendingLinkTask
    });

    // --- CELL STYLING ---
    const eventCellStyle = useCallback((event: any) => {
        return getEventCellStyle(event, workRanges, completedEvents);
    }, [workRanges, completedEvents]);

    const renderHeader = useCallback((headerProps: any) => {
        return (
            <ScheduleHeader
                headerProps={headerProps}
                events={events}
                focusRanges={focusRanges}
                lunchDifficulties={lunchDifficulties}
                weatherData={weatherData}
                moods={moods}
                isAssistantLoading={isAssistantLoading}
                showAdditionalCalendars={showAdditionalCalendars}
                onMoodPress={(date) => {
                    setMoodDate(date);
                    setMoodModalVisible(true);
                }}
                onWeatherPress={() => setWeatherModalVisible(true)}
                onGenerateSuggestions={generateSuggestions}
                onToggleAdditionalCalendars={() => setShowAdditionalCalendars(!showAdditionalCalendars)}
                onShowSummary={(data) => {
                    setSummaryData(data);
                    setSummaryModalVisible(true);
                }}
            />
        );
    }, [events, focusRanges, lunchDifficulties, weatherData, moods, isAssistantLoading, showAdditionalCalendars, generateSuggestions]);

    const freeTimeZones = useMemo(() => {
        if (!isEventsLoaded) return [];
        return detectFreeTimeZones(events, workRanges);
    }, [events, workRanges, isEventsLoaded]);



    const allEvents = useMemo(() => {
        const displayedEvents = showAdditionalCalendars ? events : events.filter(e => {
            if (e.type === 'marker' || e.type === 'zone' || !e.originalEvent?.calendarId) return true;
            const calId = e.originalEvent.calendarId;
            return personalCalendarIds.includes(calId) || workCalendarIds.includes(calId);
        });

        const base = [...displayedEvents, ...timeRangeEvents, ...focusRanges, ...freeTimeZones, ...lunchEvents, ...assistantEvents];
        if (walkEvent) base.push(walkEvent);
        return base;
    }, [events, timeRangeEvents, focusRanges, freeTimeZones, lunchEvents, walkEvent, assistantEvents, showAdditionalCalendars, personalCalendarIds, workCalendarIds]);

    const isTodaySelected = dayjs(date).isSame(dayjs(), 'day');

    const rightActions: HeaderAction[] = useMemo(() => [
        {
            render: () => (
                <TouchableOpacity
                    key="sync"
                    onPress={fetchEvents}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginHorizontal: 2
                    }}
                >
                    <Ionicons name="sync-outline" size={22} color={Colors.text.tertiary} />
                </TouchableOpacity>
            )
        },
        {
            icon: 'chevron-back',
            onPress: () => {
                const prev = dayjs(date).subtract(1, 'day').toDate();
                changeDate(prev);
                calendarRef.current?.goPrev();
            },
            color: Colors.text.tertiary,
        },
        {
            render: () => (
                <TouchableOpacity
                    key="today"
                    onPress={() => {
                        const now = new Date();
                        changeDate(now);
                        calendarRef.current?.goToDate(now);
                    }}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isTodaySelected ? Colors.surfaceHighlight : Colors.transparent,
                        marginHorizontal: 2
                    }}
                >
                    <Ionicons name="today" size={22} color={isTodaySelected ? Colors.primary : Colors.text.tertiary} />
                </TouchableOpacity>
            )
        },
        {
            icon: 'chevron-forward',
            onPress: () => {
                const next = dayjs(date).add(1, 'day').toDate();
                changeDate(next);
                calendarRef.current?.goNext();
            },
            color: Colors.text.tertiary,
        }
    ], [date, fetchEvents, isTodaySelected]);

    return (
        <DragDropProvider>
            <BaseScreen
                title="Schedule"
                subtitle={dayjs(date).format('MMMM YYYY')}
                rightActions={rightActions}
                fullBleed
                noPadding
                headerChildren={
                    <DateRuler
                        date={date}
                        onDateChange={changeDate}
                        dayStatuses={dayStatuses}
                    />
                }
            >
                {({ headerHeight }) => (
                    <View className="flex-1" style={{ paddingTop: headerHeight + 80 }}>
                        <TodaysTasksPanel
                            date={date}
                            events={events}
                            onAdd={handleAddTask}
                            onEditTask={setEditingTask}
                            onRefresh={fetchEvents}
                        />

                        {/* Calendar View */}
                        {visibleCalendarIds.length === 0 ? (
                            <NoCalendarsView />
                        ) : (
                            <View className="flex-1 overflow-hidden">
                                {/* @ts-ignore - onScroll is monkey-patched */}
                                <BigCalendar
                                    imperativeRef={calendarRef}
                                    renderHeader={renderHeader}
                                    events={allEvents}
                                    height={height}
                                    bodyContentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
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
                                                100: Colors.surfaceHighlight,
                                                200: Colors.surface,
                                                300: Colors.text.tertiary,
                                                500: Colors.text.secondary,
                                                800: Colors.text.primary,
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
                                        if (event.typeTag === 'ASSISTANT_SUGGESTION') {
                                            setSelectedEvent(event);
                                        } else if (event.type === 'marker') {
                                            setEditingEvent(event);
                                        } else if (event.type === 'zone') {
                                            setEditingEvent(event);
                                        } else {
                                            setSelectedEvent({ title: event.title, start: event.start, end: event.end, ...event }); // Spread all props to include color/typeTag
                                        }
                                    }}
                                    calendarCellStyle={{ borderColor: Colors.surfaceHighlight, backgroundColor: Colors.background }}
                                    bodyContainerStyle={{ backgroundColor: Colors.background }}
                                    renderEvent={(evt, touchableOpacityProps) => (
                                        <ScheduleEvent
                                            event={evt}
                                            touchableOpacityProps={touchableOpacityProps}
                                            timeFormat={timeFormat}
                                            onToggleCompleted={handleToggleCompleted}
                                        />
                                    )}
                                    onQuickAction={handleQuickAction}
                                    onExternalDrop={handleTaskDrop}
                                    hourComponent={useCallback(({ hour, ampm }: { hour: number, ampm: boolean }) => (
                                        <WeatherHourGuide hour={hour} ampm={ampm} date={date} />
                                    ), [date])}
                                />
                            </View>
                        )}
                    </View>
                )}
            </BaseScreen>

            {/* Context Menu Modal */}
                    <EventContextModal
                        visible={!!selectedEvent && !selectedEvent?.typeTag?.includes('LUNCH_SUGGESTION') && !selectedEvent?.typeTag?.includes('WALK_SUGGESTION') && !selectedEvent?.typeTag?.includes('ASSISTANT_SUGGESTION')}
                        onClose={() => setSelectedEvent(null)}
                        onRefresh={fetchEvents}
                        onEdit={() => setEditingEvent(selectedEvent)}
                        onOpenTask={(task) => {
                            setSelectedEvent(null);
                            setEditingTask(task);
                        }}
                        event={selectedEvent}
                    />

                    <AssistantSuggestionModal
                        visible={!!selectedEvent && selectedEvent?.typeTag === 'ASSISTANT_SUGGESTION'}
                        suggestion={selectedEvent?.originalSuggestion || null}
                        onAccept={async (s) => {
                            const success = await acceptSuggestion(s);
                            if (success) {
                                fetchEvents();
                            }
                        }}
                        onDismiss={dismissSuggestion}
                        onClose={() => setSelectedEvent(null)}
                    />

                    <UnifiedSuggestionModal
                        visible={!!selectedEvent && selectedEvent?.typeTag === 'LUNCH_SUGGESTION'}
                        onClose={() => setSelectedEvent(null)}
                        type="lunch"
                        suggestion={selectedEvent ? {
                            start: selectedEvent.start,
                            end: selectedEvent.end,
                            title: selectedEvent.title
                        } : null}
                        onEventCreated={fetchEvents}
                        onDismiss={() => setSelectedEvent(null)}
                    />

                    <UnifiedSuggestionModal
                        visible={!!selectedEvent && selectedEvent?.typeTag === 'WALK_SUGGESTION'}
                        onClose={() => setSelectedEvent(null)}
                        type="walk"
                        suggestion={selectedEvent ? {
                            start: selectedEvent.startDate,
                            reason: selectedEvent.reason
                        } : null}
                        onEventCreated={() => {
                            dismissWalk();
                            fetchEvents();
                        }}
                        onDismiss={() => {
                            dismissWalk();
                            setSelectedEvent(null);
                        }}
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
                            initialTitle={pendingLinkTask?.title}
                            timeFormat={timeFormat}
                            onCancel={() => {
                                setCreatingEventDate(null);
                                setEditingEvent(null);
                                setPendingLinkTask(null);
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
                            enableFolderSelection={true}
                            initialFolder={(editingTask as any).filePath && (editingTask as any).filePath.includes('/')
                                ? (editingTask as any).filePath.substring(0, (editingTask as any).filePath.lastIndexOf('/'))
                                : ''}
                            onDelete={async (task) => {
                                if (!vaultUri) return;
                                try {
                                    await TaskService.syncTaskDeletion(vaultUri, task as TaskWithSource);

                                    const { tasks, setTasks } = useTasksStore.getState();
                                    const taskWithSource = task as unknown as TaskWithSource;
                                    const filteredTasks = tasks.filter(t =>
                                        !(t.filePath === taskWithSource.filePath && t.originalLine === taskWithSource.originalLine)
                                    );
                                    setTasks(filteredTasks);

                                    Toast.show({ type: 'success', text1: 'Task Deleted' });
                                    setEditingTask(null);
                                } catch (e) {
                                    Toast.show({ type: 'error', text1: 'Delete Failed' });
                                }
                            }}
                            onSave={async (updatedTask, folderPath) => {
                                const { TaskService } = await import('../../../services/taskService');
                                const { ensureDirectory } = await import('../../../utils/saf');

                                if (!vaultUri) return;

                                try {
                                    // 1. Resolve Target Folder URI
                                    let targetFolderUri = vaultUri;
                                    let resolvedFolderPath = folderPath || '';

                                    if (folderPath && folderPath.trim()) {
                                        const parts = folderPath.split('/').filter(p => p.trim());
                                        for (const part of parts) {
                                            targetFolderUri = await ensureDirectory(targetFolderUri, part);
                                        }
                                    } else {
                                        const { vaultUri } = useSettingsStore.getState();
                                        const { tasksRoot } = useTasksStore.getState();
                                        if (tasksRoot) {
                                            resolvedFolderPath = tasksRoot;
                                            const parts = tasksRoot.split('/').filter(p => p.trim());
                                            for (const part of parts) {
                                                targetFolderUri = await ensureDirectory(targetFolderUri, part);
                                            }
                                        }
                                    }

                                    if (editingTask.fileUri) {
                                        // === EXISTING TASK ===
                                        const currentFolder = editingTask.filePath && editingTask.filePath.includes('/')
                                            ? editingTask.filePath.substring(0, editingTask.filePath.lastIndexOf('/'))
                                            : '';

                                        const normalizedCurrent = currentFolder.replace(/^\/+|\/+$/g, '');
                                        const normalizedNew = resolvedFolderPath.replace(/^\/+|\/+$/g, '');

                                        if (normalizedNew !== normalizedCurrent) {
                                            // MOVE Logic
                                            const defaultFile = await TaskService.findDefaultTaskFile(targetFolderUri);
                                            await TaskService.addTask(vaultUri, defaultFile.uri, updatedTask);
                                            await TaskService.syncTaskDeletion(vaultUri, editingTask);

                                            const { tasks, setTasks } = useTasksStore.getState();
                                            const filteredTasks = tasks.filter(t =>
                                                !(t.filePath === editingTask.filePath && t.originalLine === editingTask.originalLine)
                                            );

                                            const newTask: TaskWithSource = {
                                                ...updatedTask,
                                                fileUri: defaultFile.uri,
                                                filePath: resolvedFolderPath ? `${resolvedFolderPath}/${defaultFile.name}` : defaultFile.name,
                                                fileName: defaultFile.name,
                                                originalLine: serializeTaskLine(updatedTask)
                                            };

                                            setTasks([...filteredTasks, newTask]);
                                            Toast.show({ type: 'success', text1: 'Task Moved' });

                                            // Sync with Event (1-1 only)
                                            const eventIds = updatedTask.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
                                            if (eventIds.length === 1) {
                                                const eventId = eventIds[0];
                                                const relations = useRelationsStore.getState().relations[eventId];
                                                if (relations && relations.tasks.length === 1 && relations.notes.length === 0) {
                                                    const event = events.find(e => (e.originalEvent?.id === eventId || e.id === eventId));
                                                    if (event) {
                                                        const eventDateStr = dayjs(event.start).format('YYYY-MM-DD');
                                                        const isEventDone = !!completedEvents[`${event.title}::${eventDateStr}`];
                                                        const shouldBeDone = updatedTask.status === 'x';
                                                        if (isEventDone !== shouldBeDone) {
                                                            toggleCompleted(event.title, eventDateStr);
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            // UPDATE In-Place Logic
                                            try {
                                                await TaskService.syncTaskUpdate(vaultUri, editingTask, updatedTask);

                                                // Update Store
                                                const { tasks, setTasks } = useTasksStore.getState();
                                                const updatedTasks = tasks.map(t =>
                                                    (t.filePath === editingTask.filePath && t.originalLine === editingTask.originalLine)
                                                        ? { ...t, ...updatedTask, originalLine: serializeTaskLine(updatedTask) }
                                                        : t
                                                );
                                                setTasks(updatedTasks);

                                                const newTaskWithSource = { ...editingTask, ...updatedTask, originalLine: serializeTaskLine(updatedTask) };
                                                useRelationsStore.getState().updateTask(editingTask, newTaskWithSource as TaskWithSource);

                                                Toast.show({ type: 'success', text1: 'Task Updated' });

                                                // Sync with Event (1-1 only)
                                                const eventIds = updatedTask.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
                                                if (eventIds.length === 1) {
                                                    const eventId = eventIds[0];
                                                    const relations = useRelationsStore.getState().relations[eventId];
                                                    if (relations && relations.tasks.length === 1 && relations.notes.length === 0) {
                                                        const event = events.find(e => (e.originalEvent?.id === eventId || e.id === eventId));
                                                        if (event) {
                                                            const eventDateStr = dayjs(event.start).format('YYYY-MM-DD');
                                                            const isEventDone = !!completedEvents[`${event.title}::${eventDateStr}`];
                                                            const shouldBeDone = updatedTask.status === 'x';
                                                            if (isEventDone !== shouldBeDone) {
                                                                toggleCompleted(event.title, eventDateStr);
                                                            }
                                                        }
                                                    }
                                                }
                                            } catch (e: any) {
                                                if (e.message === 'FILE_NOT_FOUND') {
                                                    const { tasks, setTasks } = useTasksStore.getState();
                                                    const newTasks = tasks.filter(t =>
                                                        !(t.filePath === editingTask.filePath && t.originalLine === editingTask.originalLine)
                                                    );
                                                    setTasks(newTasks);
                                                    Toast.show({ type: 'error', text1: 'Task file missing', text2: 'Removed orphan task.' });
                                                } else {
                                                    throw e;
                                                }
                                            }
                                        }
                                    } else {
                                        // === NEW TASK ===
                                        const defaultFile = await TaskService.findDefaultTaskFile(targetFolderUri);
                                        await TaskService.addTask(vaultUri, defaultFile.uri, updatedTask);

                                        const { tasks, setTasks } = useTasksStore.getState();
                                        const newTask: TaskWithSource = {
                                            ...updatedTask,
                                            fileUri: defaultFile.uri,
                                            filePath: resolvedFolderPath ? `${resolvedFolderPath}/${defaultFile.name}` : defaultFile.name,
                                            fileName: defaultFile.name,
                                            originalLine: serializeTaskLine(updatedTask)
                                        };
                                        setTasks([...tasks, newTask]);
                                        Toast.show({ type: 'success', text1: 'Task Created' });
                                    }
                                } catch (e: any) {
                                    console.error('[ScheduleScreen] Failed to save/move task', e);
                                    showError("Error", `Failed to save task: ${e.message || 'Unknown error'}`);
                                } finally {
                                    setEditingTask(null);
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

                    <DragOverlay />
                </View>
                )}
            </BaseScreen>
        </DragDropProvider>
    );
}

export default ScheduleScreen;
