import { useState, useEffect, useCallback } from 'react';
import { Event } from 'expo-calendar'; // Or your internal Event type
import { useWalkStore } from '../../../../store/walkStore';
import { suggestWalkTime, WalkSuggestionContext } from '../../../../services/gemini';
import { useSettingsStore } from '../../../../store/settings';
import dayjs from 'dayjs';
import { HourlyWeatherData } from '../../../../services/weatherService';
import { useEventTypesStore } from '../../../../store/eventTypes';
import { findBestSlot } from '../../../../utils/slotFinder';
import { Palette } from '../../design-tokens';

interface UseWalkSuggestionProps {
    events: any[]; // Event[]
    extraEvents?: any[]; // For things like Suggested Lunch to avoid
    selectedDate: Date | string;
    weather: HourlyWeatherData[];
    apiKey: string;
}

export function useWalkSuggestion({ events, extraEvents = [], selectedDate, weather, apiKey }: UseWalkSuggestionProps) {
    const {
        suggestions,
        setSuggestion,
        isDismissed,
        dismissForDate
    } = useWalkStore();

    const { walkPrompt, walkLookaheadDays = 0 } = useSettingsStore();
    const { ranges, eventFlags } = useEventTypesStore();

    const dateObj = dayjs(selectedDate);
    const dateStr = dateObj.format('YYYY-MM-DD');
    const today = dayjs();

    // Check if date is within [today, today + lookahead]
    const diffDays = dateObj.startOf('day').diff(today.startOf('day'), 'day');
    const dayOfWeek = dateObj.day();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isEligibleDate = diffDays >= 0 && diffDays <= walkLookaheadDays && isWeekday;

    const currentSuggestion = suggestions[dateStr];

    // Check if there is already a "Walk" event on this day in the calendar
    const hasExistingWalk = events.some(e =>
        !e.isVirtual &&
        e.title?.toLowerCase().includes('walk') &&
        dayjs(e.start).format('YYYY-MM-DD') === dateStr
    );

    const [isLoading, setIsLoading] = useState(false);

    const fetchSuggestion = useCallback(async () => {
        if (!isEligibleDate || !apiKey) return;
        if (isDismissed(dateStr) || hasExistingWalk) return;

        if (currentSuggestion) return;

        // Find best slot using slotFinder (same logic as lunch)
        const walkRangeDef = ranges.find(r => r.title === 'Walk' && r.isEnabled);

        // If no range defined, fallback to old hardcoded 10-19 range or skip
        if (!walkRangeDef) {
            console.warn("No 'Walk' time range defined. Please add one in Settings.");
            return;
        }

        // Combine busy events with extraEvents (like lunch)
        const allBusy = [...events, ...extraEvents];
        const bestSlot = findBestSlot(dateObj, walkRangeDef, allBusy, eventFlags, 60);

        // Only suggest walks in completely free slots (Tier 1) to avoid conflicts with personal/movable events
        if (!bestSlot || bestSlot.tier > 1) return;

        setIsLoading(true);
        try {
            const context: WalkSuggestionContext = {
                schedule: events.map(e => ({
                    title: e.title,
                    start: e.calendarFormatStr,
                    end: e.endDate,
                    isAllDay: e.allDay
                })),
                weather: weather,
                preferredTimeRange: {
                    start: bestSlot.start.hour(),
                    end: bestSlot.end.hour() || 24
                },
                date: dateStr
            };

            const result = await suggestWalkTime(apiKey, context, walkPrompt || undefined);

            if (result) {
                // Ensure result matches the slot found or at least is in the window
                setSuggestion({
                    start: bestSlot.start.toISOString(), // Use the found slot start
                    reason: result.reason,
                    date: dateStr
                });
            }
        } catch (e) {
            console.error("Error fetching walk suggestion", e);
        } finally {
            setIsLoading(false);
        }
    }, [isEligibleDate, apiKey, dateStr, isDismissed, hasExistingWalk, currentSuggestion, events, extraEvents, weather, walkPrompt, setSuggestion, ranges, eventFlags, dateObj]);

    // Effect to trigger fetch
    useEffect(() => {
        // Only fetch if eligible, not dismissed, no walk exists yet, no suggestion yet, and weather is loaded
        if (isEligibleDate && !isDismissed(dateStr) && !hasExistingWalk && !currentSuggestion && weather.length > 0) {
            const timeout = setTimeout(() => {
                fetchSuggestion();
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [isEligibleDate, dateStr, isDismissed, hasExistingWalk, currentSuggestion, weather, fetchSuggestion, apiKey]);

    // Convert suggestion to a "Virtual Event" for rendering
    const walkEvent = (isEligibleDate && currentSuggestion && !isDismissed(dateStr) && !hasExistingWalk) ? {
        id: 'walk-suggestion',
        title: 'Walk (suggested)',
        startDate: currentSuggestion.start,
        endDate: dayjs(currentSuggestion.start).add(60, 'minute').toISOString(),
        start: new Date(currentSuggestion.start), // BigCalendar often needs Date objects too
        end: dayjs(currentSuggestion.start).add(60, 'minute').toDate(),
        color: Palette[9], // Emerald 500
        isVirtual: true,
        type: 'walk-suggestion',
        typeTag: 'WALK_SUGGESTION',
        reason: currentSuggestion.reason
    } : null;

    return {
        walkEvent,
        isLoading,
        refresh: fetchSuggestion,
        dismiss: () => dismissForDate(dateStr)
    };
}
