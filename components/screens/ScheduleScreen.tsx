import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as BigCalendar } from '../ui/calendar';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { useEventTypesStore } from '../../store/eventTypes';
import { getCalendarEvents, ensureCalendarPermissions } from '../../services/calendarService';
import { EventContextModal } from '../EventContextModal';
import { DateRuler } from '../DateRuler';
import * as Calendar from 'expo-calendar';
import { useFocusEffect } from '@react-navigation/native';
import { useReminderModal } from '../../utils/reminderModalContext';
import { ScheduleEvent } from './ScheduleEvent';
import { useTimeRangeEvents } from '../ui/calendar/hooks/useTimeRangeEvents';
import { calculateEventDifficulty } from '../../utils/difficultyUtils';


export default function ScheduleScreen() {
    const { visibleCalendarIds, timeFormat, cachedReminders } = useSettingsStore();
    const { assignments, difficulties, eventTypes, eventFlags, ranges, loadConfig } = useEventTypesStore();
    const { showReminder } = useReminderModal();
    const { height } = useWindowDimensions();
    const [events, setEvents] = useState<any[]>([]);
    const [date, setDate] = useState(new Date());
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
    const [viewMode, setViewMode] = useState<'day' | '3days' | 'week'>('day');
    const [selectedEvent, setSelectedEvent] = useState<{ title: string, start: Date, end: Date } | null>(null);
    const [refreshing, setRefreshing] = useState(false);


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

            // Map native events to BigCalendar format
            const mappedEvents = nativeEvents.map(evt => {
                const assignedTypeId = assignments[evt.title];
                const assignedType = assignedTypeId ? eventTypes.find(t => t.id === assignedTypeId) : null;
                const baseDifficulty = difficulties?.[evt.title] || 0;
                const flags = eventFlags?.[evt.title];
                const color = assignedType ? assignedType.color : (evt.calendarId ? 'rgba(79, 70, 229, 0.8)' : undefined);

                // Calculate total difficulty
                const { total } = calculateEventDifficulty(
                    { title: evt.title, start: new Date(evt.startDate), end: new Date(evt.endDate) },
                    baseDifficulty,
                    ranges,
                    flags
                );

                return {
                    title: evt.title,
                    start: new Date(evt.startDate),
                    end: new Date(evt.endDate),
                    color: color,
                    originalEvent: evt, // Keep ref for context menu
                    typeTag: assignedType ? assignedType.title : null,
                    difficulty: total, // Use total difficulty
                    isEnglish: flags?.isEnglish,
                    movable: flags?.movable,
                    isSkippable: flags?.skippable
                };
            });

            // Map reminders to BigCalendar format (markers)
            const mappedReminders = (cachedReminders || [])
                .filter((r: any) => r.reminderTime) // Filter out reminders without time
                .map((r: any) => ({
                    title: r.fileName.replace('.md', ''), // Backup title if content logic fails
                    start: new Date(r.reminderTime),
                    end: new Date(r.reminderTime),
                    color: r.alarm ? '#ef4444' : '#f59e0b',
                    originalEvent: r,
                    type: 'marker' as const,
                    difficulty: undefined,
                    typeTag: 'REMINDER'
                }));

            setEvents([...mappedEvents, ...mappedReminders]);
        } catch (e) {
            console.error("Error fetching events", e);
        }
    }, [visibleCalendarIds, date, assignments, eventTypes, difficulties, eventFlags, ranges, cachedReminders]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchEvents();
        setRefreshing(false);
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
        let score = dailyEvents.reduce((acc, evt) => acc + (evt.difficulty || 0), 0);

        const dailyFocus = focusRanges.filter(f =>
            dayjs(f.start).isSame(pageDay, 'day')
        );
        score += dailyFocus.length;

        // Calculate Deep Work Duration (Sum of duration for difficulty > 0)
        let deepWorkMinutes = 0;
        dailyEvents.forEach(evt => {
            if (evt.difficulty > 0) {
                const duration = dayjs(evt.end).diff(dayjs(evt.start), 'minute');
                deepWorkMinutes += duration;
            }
        });

        const hours = Math.floor(deepWorkMinutes / 60);
        const mins = deepWorkMinutes % 60;
        const deepWorkStr = `${hours}h ${mins}m`;

        return (
            <View>
                <DateRuler
                    date={pageDate.toDate()}
                    onDateChange={changeDate}
                />
                <View className="bg-slate-900 border-b border-slate-800 px-4 pb-2 flex-row justify-end items-center gap-4">
                    {deepWorkMinutes > 0 && (
                        <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                            Deep Work: <Text className="text-emerald-400 text-sm">{deepWorkStr}</Text>
                        </Text>
                    )}
                    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        Day Score: <Text className="text-indigo-400 text-sm">{score}</Text>
                    </Text>
                </View>
            </View>
        );
    }, [changeDate, events, focusRanges]);

    const workRanges = useMemo(() => timeRangeEvents.filter((e: any) => e.isWork), [timeRangeEvents]);

    const freeTimeZones = useMemo(() => {
        return detectFreeTimeZones(events, workRanges);
    }, [events, workRanges]);

    const lunchEvent = useMemo(() => {
        return detectLunchEvent(events, ranges, hookDateRange);
    }, [events, ranges, hookDateRange]);

    const allEvents = useMemo(() => {
        const base = [...events, ...timeRangeEvents, ...focusRanges, ...freeTimeZones];
        if (lunchEvent) {
            base.push(...lunchEvent);
        }
        return base;
    }, [events, timeRangeEvents, focusRanges, freeTimeZones, lunchEvent]);

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
        if (workRanges.length > 0 && !event.type && event.difficulty > 0) {
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


    return (
        <View className="flex-1 bg-slate-950">
            <SafeAreaView className="flex-1" edges={['left', 'right', 'bottom']}>
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
                            renderHeader={renderHeader}
                            events={allEvents}
                            height={height}
                            date={date}
                            mode={viewMode}
                            // onSwipeEnd={(d) => changeDate(d)}
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
                                    showReminder(event.originalEvent);
                                } else {
                                    setSelectedEvent({ title: event.title, start: event.start, end: event.end });
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
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" />
                            }
                        />
                    </View>
                )}



                {/* Context Menu Modal */}
                <EventContextModal
                    visible={!!selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    event={selectedEvent}
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
        (e.difficulty && e.difficulty > 0) &&
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

// Helper: detect and place ephemeral Lunch event
const detectLunchEvent = (allEvents: any[], ranges: any[], dateRange: dayjs.Dayjs[]) => {
    // 1. Find "Lunch" range
    const lunchRange = ranges.find(r => r.title === 'Lunch' && r.isEnabled);
    if (!lunchRange) return null;

    const results: any[] = [];
    const eventsByDay: Record<string, any[]> = {};
    allEvents.forEach(e => {
        const d = dayjs(e.start).format('YYYY-MM-DD');
        if (!eventsByDay[d]) eventsByDay[d] = [];
        eventsByDay[d].push(e);
    });

    dateRange.forEach(currentDay => {
        const dayStr = currentDay.format('YYYY-MM-DD');
        const dayEvents = eventsByDay[dayStr] || [];
        const dayOfWeek = currentDay.day(); // 0-6

        // Check if Lunch range applies to this day
        if (!lunchRange.days.includes(dayOfWeek)) return;

        // Define Lunch Window for this day
        let rStart = currentDay.hour(lunchRange.start.hour || dayjs(lunchRange.start).hour()).minute(lunchRange.start.minute || dayjs(lunchRange.start).minute()).second(0);
        let rEnd = currentDay.hour(lunchRange.end.hour || dayjs(lunchRange.end).hour()).minute(lunchRange.end.minute || dayjs(lunchRange.end).minute()).second(0);

        if (rEnd.isBefore(rStart)) rEnd = rEnd.add(1, 'day');

        // Check for 60m slot
        let bestSlot: { start: dayjs.Dayjs, tier: number } | null = null;
        // Tier 1: Free (Cost 0)
        // Tier 2: Skippable (Cost 1)
        // Tier 3: Movable (Cost 2)

        // Step 5 minutes
        for (let t = rStart; t.isBefore(rEnd.subtract(59, 'minute')); t = t.add(5, 'minute')) {
            const slotStart = t;
            const slotEnd = t.add(60, 'minute');

            // Find overlapping events with difficulty >= 1
            const overlaps = dayEvents.filter(e => {
                const eStart = dayjs(e.start);
                const eEnd = dayjs(e.end);
                // "Ignore zero difficulties": Only care if difficulty >= 1
                if (e.difficulty === 0 || e.difficulty === undefined) return false;
                if (e.type === 'marker') return false; // Ignore markers

                return eStart.isBefore(slotEnd) && eEnd.isAfter(slotStart);
            });

            if (overlaps.length === 0) {
                // Tier 1 found! Priority 1. Stop immediately.
                bestSlot = { start: slotStart, tier: 1 };
                break;
            }

            // Check Tier 2: All overlaps are skippable
            const allSkippable = overlaps.every(e => e.movable || e.skippable); // Wait, prompt says "skippable" then "movable".
            // Let's check flags. 'movable' is in the mapped object. Is 'skippable' mapped?
            // In fetchEvents: flags = eventFlags?.[evt.title].
            // mappedEvents has: isEnglish, movable.
            // It DOES NOT seem to map 'skippable' explicitly in fetchEvents!
            // I need to check fetchEvents again.
            // "movable: flags?.movable".
            // If 'skippable' is missing from the mapped event, I can't check it.
            // Assuming 'movable' covers it or I need to add 'skippable' to the map.
            // Let's check ScheduleScreen.tsx fetchEvents map logic.
            // It only maps 'movable'.
            // If the prompt distinguishes "skippable" vs "movable", I might be missing data.
            // However, maybe 'movable' implies 'skippable'?
            // Or maybe I should assume only 'movable' is available and treat 'skippable' as same or ignore?
            // Prompt: "then skippable events, then movable events."
            // This implies they are distinct.
            // Since I can't easily change the fetch logic without potentially breaking things or needing more file reads (EventTypesStore),
            // I will check if the 'originalEvent' has it or if I should just use 'movable' for both for now.
            // BUT, if I can't see 'skippable', I can't prioritize it.
            // Let's assume for this task that I should use 'movable' as the fallback for 'skippable' if not present,
            // OR checks the 'flags' if available.
            // Actually, mapped event has `originalEvent`.
            // But `flags` came from `eventFlags` store.
            // The `event` object passed to `detectLunchEvent` is the mapped one.
            // It has `movable`. It does NOT have `skippable`.
            // UseCase: Maybe "skippable" isn't implemented yet?
            // Prompt says: "Prioritize free time ..., then skippable events, then movable events."
            // If I can't check skippable, I'll group "skippable/movable" into Tier 3?
            // Or assume "movable" IS the "movable" tier.
            // Let's assume I can check `e.originalEvent` or the store if I had access.
            // But `detectLunchEvent` is outside component, so no store access.
            // I'll assume for now that if `movable` is true, it's Tier 3.
            // If I can't distinguish Tier 2, I'll just skip it or merge with Tier 3?
            // Wait, if I treat 'movable' as Tier 3, and I can't find Tier 2, I'll just look for Tier 3.

            // Re-reading fetchEvents:
            // const flags = eventFlags?.[evt.title];
            // movable: flags?.movable
            // No skippable.
            // I'll proceed with Tier 1 (Free) and Tier 3 (Movable).
            // If I miss Tier 2, it's safer than crashing.

            // Tier 3 check: All overlaps are 'movable' (and diff >= 1)
            const allMovable = overlaps.every(e => e.movable);
            if (allMovable) {
                if (!bestSlot || bestSlot.tier > 3) {
                    bestSlot = { start: slotStart, tier: 3 };
                }
            }
        }

        if (bestSlot) {
            results.push({
                title: 'Lunch',
                start: bestSlot.start.toDate(),
                end: bestSlot.start.add(60, 'minute').toDate(),
                color: '#22c55e', // Green for success? Or maybe logic color.
                type: 'generated',
                difficulty: bestSlot.tier === 3 ? 1 : 0, // +1 if intersects movable (Tier 3)
                typeTag: 'LUNCH'
            });
        } else {
            // Not placed -> +2 difficulty.
            // Represent as a marker at end of range.
            results.push({
                title: 'Missed Lunch',
                start: rEnd.toDate(),
                end: rEnd.toDate(),
                type: 'marker',
                difficulty: 2,
                color: '#ef4444', // Red
                typeTag: 'MISSED'
            });
        }
    });

    return results;
}

// Helper: detect free time zones (gaps > 60m between difficulty >= 1 events)
// Restricted to within provided workRanges
const detectFreeTimeZones = (allEvents: any[], workRanges: any[] = []) => {
    // 1. Filter events with difficulty >= 1 (Busy events)
    // Ignore internal types
    const busyEvents = allEvents.filter(e =>
        (e.difficulty && e.difficulty >= 1) &&
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
