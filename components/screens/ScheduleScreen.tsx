import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, RefreshControl } from 'react-native';
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
import * as FileSystem from 'expo-file-system';
import { useFocusEffect } from '@react-navigation/native';
import { useReminderModal } from '../../utils/reminderModalContext';
import { ScheduleEvent } from './ScheduleEvent';
import { useTimeRangeEvents } from '../ui/calendar/hooks/useTimeRangeEvents';
import { calculateEventDifficulty } from '../../utils/difficultyUtils';
import { useLunchSuggestion } from '../ui/calendar/hooks/useLunchSuggestion';
import { LunchContextModal } from '../LunchContextModal';
import { calculateDayStatus, aggregateDayStats, DayBreakdown, DayStatusLevel } from '../../utils/difficultyUtils';
import { DayStatusMarker } from '../DayStatusMarker'; import { DaySummaryModal } from '../DaySummaryModal';
import { ReminderEditModal, ReminderSaveData } from '../ReminderEditModal';
import { updateReminder, toLocalISOString, createStandaloneReminder, Reminder } from '../../services/reminderService';
import { EventCreateModal, EventSaveData } from '../EventCreateModal';
import { createCalendarEvent, getWritableCalendars } from '../../services/calendarService';

import { getWeatherForecast, getWeatherIcon, WeatherData } from '../../services/weatherService';
import { useMoodStore } from '../../store/moodStore';
import { MoodEvaluationModal } from '../MoodEvaluationModal';


export default function ScheduleScreen() {
    const { visibleCalendarIds, timeFormat, cachedReminders, setCachedReminders, defaultCreateCalendarId, defaultOpenCalendarId, weatherLocation } = useSettingsStore();
    const { assignments, difficulties, eventTypes, eventFlags, ranges, loadConfig } = useEventTypesStore();
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
    const [refreshing, setRefreshing] = useState(false);
    const [summaryModalVisible, setSummaryModalVisible] = useState(false);
    const [summaryData, setSummaryData] = useState<{ breakdown: DayBreakdown, status: any, date: Date } | null>(null);
    const [editingReminder, setEditingReminder] = useState<any | null>(null);
    const [creatingEventDate, setCreatingEventDate] = useState<Date | null>(null);
    const [moodModalVisible, setMoodModalVisible] = useState(false);
    const [moodDate, setMoodDate] = useState<Date>(new Date());
    const calendarRef = useRef<CalendarRef>(null);

    const handleDeleteReminder = async (reminder: Reminder) => {
        // Optimistic Delete
        const targetUri = reminder.fileUri;
        setCachedReminders(cachedReminders.filter((r: any) => r.fileUri !== targetUri));
        setEvents(prev => prev.filter(e => e.originalEvent?.fileUri !== targetUri));

        // Close Modal
        setEditingReminder(null);

        // Async Delete
        try {
            await updateReminder(targetUri, null); // Pass null to delete
        } catch (e) {
            console.error("Failed to delete reminder:", e);
            alert("Failed to delete reminder");
            // Revert state if needed? (Ideally we reload)
            fetchEvents();
        }
    };

    const handleDeleteReminderWithNote = async (reminder: Reminder) => {
        const targetUri = reminder.fileUri;
        
        // Optimistic Delete
        setCachedReminders(cachedReminders.filter((r: any) => r.fileUri !== targetUri));
        setEvents(prev => prev.filter(e => e.originalEvent?.fileUri !== targetUri));
        setEditingReminder(null);

        // Async Delete: note file + reminder
        try {
            await FileSystem.deleteAsync(targetUri, { idempotent: true });
        } catch (e) {
            console.error("Failed to delete note file:", e);
            alert("Failed to delete note");
            fetchEvents();
        }
    };

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
        if (visibleCalendarIds.length === 0) {
            setEvents([]);
            return;
        }

        const start = dayjs(date).startOf('week').subtract(1, 'week').toDate();
        const end = dayjs(date).endOf('week').add(1, 'week').toDate();

        try {
            const nativeEvents = await getCalendarEvents(visibleCalendarIds, start, end);
            // Fetch ALL calendars to get colors/names for merged events, not just writable ones
            const allCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const calDetailsMap = allCalendars.reduce((acc, cal) => {
                acc[cal.id] = { title: cal.title, color: cal.color, source: cal.source.name };
                return acc;
            }, {} as Record<string, { title: string, color: string, source: string }>);

            // Map native events to BigCalendar format
            const mappedEvents = nativeEvents.map(evt => {
                const assignedTypeId = assignments[evt.title];
                const assignedType = assignedTypeId ? eventTypes.find(t => t.id === assignedTypeId) : null;
                const baseDifficulty = difficulties?.[evt.title] || 0;
                const flags = eventFlags?.[evt.title];
                const color = assignedType ? assignedType.color : (evt.calendarId ? 'rgba(79, 70, 229, 0.8)' : undefined);

                // Calculate total difficulty
                const difficultyResult = calculateEventDifficulty(
                    { title: evt.title, start: new Date(evt.startDate), end: new Date(evt.endDate) },
                    baseDifficulty,
                    ranges,
                    flags
                );

                // Resolve merged calendars
                const mergedIds = (evt as any).mergedCalendarIds || [evt.calendarId];
                const sourceCalendars = mergedIds.map((id: string) => {
                    const details = calDetailsMap[id];
                    return {
                        id,
                        title: details?.title || 'Unknown Calendar',
                        color: details?.color || '#888888',
                        source: details?.source || ''
                    };
                });
                // Deduplicate by ID just in case
                const uniqueSourceCalendars = Array.from(new Map(sourceCalendars.map((c: any) => [c.id, c])).values());

                return {
                    title: evt.title,
                    start: new Date(evt.startDate),
                    end: new Date(evt.endDate),
                    color: color,
                    originalEvent: {
                        ...evt,
                        sourceCalendars: uniqueSourceCalendars,
                        source: { name: calDetailsMap[evt.calendarId]?.source || '' }
                    }, // Keep ref for context menu with source info
                    typeTag: assignedType ? assignedType.title : null,
                    difficulty: difficultyResult, // Use full difficulty object
                    isEnglish: flags?.isEnglish,
                    movable: flags?.movable,
                    isSkippable: flags?.skippable,
                    needPrep: flags?.needPrep,
                    isRecurrent: !!evt.recurrenceRule, // Non-null means recurring
                    hideBadges: assignedType?.hideBadges // From event type
                };
            });

            // Map reminders to BigCalendar format (markers)
            const mappedReminders = (cachedReminders || [])
                .filter((r: any) => r.reminderTime) // Filter out reminders without time
                .map((r: any) => ({
                    title: r.title || r.fileName.replace('.md', ''), // Backup title if content logic fails
                    start: new Date(r.reminderTime),
                    end: new Date(r.reminderTime),
                    color: r.alarm ? '#ef4444' : '#f59e0b',
                    originalEvent: r,
                    type: 'marker' as const,
                    difficulty: undefined,
                    typeTag: 'REMINDER'
                }));

            setEvents([...mappedEvents, ...mappedReminders]);
            setIsEventsLoaded(true);
        } catch (e) {
            console.error("Error fetching events", e);
        }
    }, [visibleCalendarIds, date, assignments, eventTypes, difficulties, eventFlags, ranges, cachedReminders, defaultOpenCalendarId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchEvents();
        setRefreshing(false);
    };

    const handleQuickAction = useCallback((action: 'event' | 'reminder', date: Date) => {
        if (action === 'reminder') {
            setEditingReminder({
                reminderTime: date.toISOString(),
                fileName: '', // Will be generated or handled by ReminderEditModal logic if needed, but assuming new
                recurrenceRule: null,
                alarm: false,
                persistent: false,
                isNew: true, // Flag to indicate new creation if needed
                fileUri: `temp-${Date.now()}` // Temporary URI to track this item during creation
            });
        } else if (action === 'event') {
            setCreatingEventDate(date);
        }
    }, [setEditingReminder, setCreatingEventDate]);

    const handleCreateEvent = (data: EventSaveData) => {
        // 1. Close modal immediately
        setCreatingEventDate(null);

        // 2. Optimistic Update
        const tempEvent = {
            title: data.title,
            start: data.startDate,
            end: data.endDate,
            color: '#818cf8', // Default blue
            type: 'event', // Internal marker
            originalEvent: {
                title: data.title,
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString()
            }
        };

        // Add to local state immediately
        setEvents(prev => [...prev, tempEvent]);

        // 3. Background Async Creation
        (async () => {
            console.log('[ScheduleScreen] Starting background event creation for:', data.title);
            try {
                // Better calendar selection logic (prioritize writable)
                const calendars = await getWritableCalendars();
                let targetCalendar;

                // Priority 1: User Default for Create
                if (defaultCreateCalendarId) {
                    targetCalendar = calendars.find(c => c.id === defaultCreateCalendarId && c.allowsModifications);
                    if (targetCalendar) console.log('[ScheduleScreen] Using default create calendar:', targetCalendar.title);
                }

                // Priority 2: Explicit Writable
                if (!targetCalendar) {
                    targetCalendar = calendars.find(c => c.allowsModifications);
                    if (targetCalendar) console.log('[ScheduleScreen] Using first writable calendar:', targetCalendar.title);
                }

                // Priority 3: First Visible (if writable)
                if (!targetCalendar && visibleCalendarIds.length > 0) {
                    targetCalendar = calendars.find(c => c.id === visibleCalendarIds[0] && c.allowsModifications);
                    if (targetCalendar) console.log('[ScheduleScreen] Using first visible calendar:', targetCalendar.title);
                }

                // Priority 4: Fallback to first available
                if (!targetCalendar && calendars.length > 0) {
                    targetCalendar = calendars[0];
                    console.log('[ScheduleScreen] Fallback to first available calendar:', targetCalendar.title);
                }

                if (!targetCalendar) {
                    console.error('[ScheduleScreen] No suitable calendar found to create event.');
                    alert('No suitable calendar found to create event.');
                    fetchEvents(); // Revert
                    return;
                }

                if (!targetCalendar.allowsModifications) {
                    console.warn('[ScheduleScreen] Selected calendar does not allow modifications:', targetCalendar.title);
                    // Proceeding anyway but likely to fail
                }

                console.log('[ScheduleScreen] Creating event in calendar ID:', targetCalendar.id);
                const newEventId = await createCalendarEvent(targetCalendar.id, {
                    title: data.title,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    allDay: data.allDay,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                });
                console.log('[ScheduleScreen] Event created successfully! ID:', newEventId);

                // 4. Re-sync to get real ID and finalized data
                setTimeout(() => {
                    console.log('[ScheduleScreen] Refreshing events after creation...');
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

        return (
            <View className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex-row justify-between items-center">
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
                        <View className="flex-row items-center gap-1">
                            <Ionicons name={weather.icon as any} size={16} color="#94a3b8" />
                            <Text className="text-slate-400 text-xs font-semibold">
                                {Math.round(weather.maxTemp)}°C
                            </Text>
                        </View>
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
        const style: any = {
            backgroundColor: event.color || '#4f46e5',
            borderColor: '#eeeeee66',
            borderWidth: 1,
            borderRadius: 4,
            opacity: 0.7,
            marginTop: -1
        };

        // Highlight events outside work hours (red dashed border)
        if (workRanges.length > 0 && !event.type && (event.difficulty?.total || 0) > 0) {
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
    }, [workRanges]);

    const handleEventDrop = async (event: any, newDate: Date) => {
        // Only allow dropping reminders for now
        if (event.typeTag !== 'REMINDER' && !event.originalEvent?.fileUri) {
            alert('Only reminders can be rescheduled locally.');
            return;
        }

        console.log('[ScheduleScreen] Dropped reminder:', event.title, 'to', newDate);

        const originalReminder = event.originalEvent;
        // const oldTime = originalReminder.reminderTime;
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
            // Revert (fetchEvents will likely handle this on mount/focus, but manual revert is better)
            // For now relying on store state which might be stale if we don't revert explicitly.
            // But we didn't save old cachedReminders locally in this scop.
            // Use setCachedReminders((prev) => ...) pattern if needed.
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
                    onSync={handleRefresh}
                    isSyncing={refreshing}
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
                                        fontSize: 16,
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
                                    setEditingReminder(event.originalEvent);
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
                                />
                            )}
                            // refreshing={refreshing}
                            // onRefresh={handleRefresh}
                            onQuickAction={handleQuickAction}
                        />
                    </View>
                )}



                {/* Context Menu Modal */}
                <EventContextModal
                    visible={!!selectedEvent && !selectedEvent?.typeTag?.includes('LUNCH_SUGGESTION')}
                    onClose={() => setSelectedEvent(null)}
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

                {editingReminder && (
                    <ReminderEditModal
                        visible={!!editingReminder}
                        initialDate={new Date(editingReminder.reminderTime)}
                        initialTitle={editingReminder.title || editingReminder.fileName.replace('.md', '')}
                        enableTitle={true}
                        initialRecurrence={editingReminder.recurrenceRule}
                        initialAlarm={editingReminder.alarm}
                        initialPersistent={editingReminder.persistent}
                        initialContent={editingReminder.content}
                        initialFileUri={editingReminder.fileUri}
                        timeFormat={timeFormat}
                        onCancel={() => setEditingReminder(null)}
                        onDelete={() => {
                            // Long press: Remove reminder only (keep note)
                            if (editingReminder && !editingReminder.isNew) {
                                handleDeleteReminder(editingReminder);
                            } else {
                                setEditingReminder(null);
                            }
                        }}
                        onDeleteWithNote={() => {
                            // Default tap: Remove reminder AND note
                            if (editingReminder && !editingReminder.isNew) {
                                handleDeleteReminderWithNote(editingReminder);
                            } else {
                                setEditingReminder(null);
                            }
                        }}
                        onShow={() => {
                            if (editingReminder) {
                                showReminder(editingReminder);
                            }
                        }}
                        onSave={(data) => {
                            if (editingReminder) {
                                // 1. Capture payload for async operations
                                const targetUri = editingReminder.fileUri;
                                const currentEditingReminder = editingReminder;

                                // 2. Optimistic Update (Cache & Events)
                                const updatedReminder = {
                                    ...editingReminder,
                                    reminderTime: data.date.toISOString(),
                                    recurrenceRule: data.recurrence,
                                    alarm: data.alarm,
                                    persistent: data.persistent,
                                    title: data.title
                                };

                                // Cache update
                                if (currentEditingReminder.isNew) {
                                    setCachedReminders([...cachedReminders, updatedReminder]);
                                } else {
                                    const newCache = cachedReminders.map((r: any) =>
                                        r.fileUri === targetUri ? updatedReminder : r
                                    );
                                    setCachedReminders(newCache);
                                }

                                // Events state update (Immediate UI reflection)
                                const tempEvent = {
                                    title: data.title || (currentEditingReminder.isNew ? 'Reminder' : 'Untitled'),
                                    start: data.date,
                                    end: data.date,
                                    color: data.alarm ? '#ef4444' : '#f59e0b',
                                    type: 'reminder',
                                    originalEvent: updatedReminder
                                };

                                if (currentEditingReminder.isNew) {
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

                                // 3. Close Modal IMMEDIATELY
                                setEditingReminder(null);

                                // 4. Async Persistence (Fire & Forget/Background)
                                (async () => {
                                    try {
                                        if (currentEditingReminder.isNew) {
                                            const result = await createStandaloneReminder(
                                                data.date.toISOString(),
                                                data.title,
                                                data.recurrence,
                                                data.alarm,
                                                data.persistent
                                            );
                                            console.log('[ScheduleScreen] Created new standalone reminder:', result);

                                            // Update cache with real URI and remove isNew flag immediately
                                            // This prevents "rescheduling creates new reminder" bug if user edits again before sync
                                            if (result) {
                                                const { cachedReminders, setCachedReminders } = useSettingsStore.getState();
                                                const updatedCache = cachedReminders.map((r: any) => {
                                                    if (r.fileUri === currentEditingReminder.fileUri) {
                                                        return {
                                                            ...r,
                                                            fileUri: result.uri,
                                                            isNew: false,
                                                            fileName: result.fileName
                                                        };
                                                    }
                                                    return r;
                                                });
                                                setCachedReminders(updatedCache);

                                                // Update events state as well to prevent "edit pending" issues
                                                setEvents(prevEvents => prevEvents.map(e => {
                                                    if (e.originalEvent && e.originalEvent.fileUri === currentEditingReminder.fileUri) {
                                                        return {
                                                            ...e,
                                                            originalEvent: {
                                                                ...e.originalEvent,
                                                                fileUri: result.uri,
                                                                fileName: result.fileName,
                                                                isNew: false
                                                            }
                                                        };
                                                    }
                                                    return e;
                                                }));
                                            }
                                        } else {
                                            await updateReminder(
                                                targetUri!,
                                                data.date.toISOString(),
                                                data.recurrence,
                                                data.alarm,
                                                data.persistent,
                                                data.title
                                            );
                                        }
                                    } catch (e) {
                                        console.error("Failed to save reminder:", e);
                                    }
                                })();
                            }
                        }}
                    />
                )}

                {creatingEventDate && (
                    <EventCreateModal
                        visible={!!creatingEventDate}
                        initialDate={creatingEventDate}
                        timeFormat={timeFormat}
                        onCancel={() => setCreatingEventDate(null)}
                        onSave={handleCreateEvent}
                    />
                )}

                <MoodEvaluationModal
                    visible={moodModalVisible}
                    onClose={() => setMoodModalVisible(false)}
                    date={moodDate}
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
    // Ignore internal types
    const busyEvents = allEvents.filter(e =>
        (e.difficulty?.total >= 1) &&
        !e.type
    );

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
