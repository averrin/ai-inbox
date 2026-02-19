import React from 'react';
import dayjs from 'dayjs';
import { useEventTypesStore } from '../../../../store/eventTypes';
import { ICalendarEventBase } from '../interfaces';
import { findBestSlot } from '../../../../utils/slotFinder';

interface LunchSuggestionResult {
    lunchEvents: any[];
    dayDifficulties: Record<string, number>; // date "YYYY-MM-DD" -> added difficulty
}

/**
 * Hook to detect and generate ephemeral lunch suggestion events.
 * Prioritizes:
 * 1. Free time > 60m (No penalty)
 * 2. Overlapping Skippable events (No penalty - if implemented, otherwise treat as Movable)
 * 3. Overlapping Movable events (Penalty +1)
 * 4. Missed Lunch (Penalty +2)
 */
export function useLunchSuggestion(
    events: any[],
    dateRange: dayjs.Dayjs[]
): LunchSuggestionResult {
    const { ranges, eventFlags } = useEventTypesStore();

    return React.useMemo(() => {
        const lunchEvents: any[] = [];
        const dayDifficulties: Record<string, number> = {};

        // 1. Find the "Lunch" range definition
        const lunchRangeDef = ranges.find(r => r.title === 'Lunch' && r.isEnabled);
        if (!lunchRangeDef) {
            return { lunchEvents: [], dayDifficulties: {} };
        }

        // Group events by day for faster lookups
        const eventsByDay: Record<string, any[]> = {};
        events.forEach(e => {
            const d = dayjs(e.start).format('YYYY-MM-DD');
            if (!eventsByDay[d]) eventsByDay[d] = [];
            eventsByDay[d].push(e);
        });

        // Process each day in the view
        dateRange.forEach(currentDay => {
            const dayStr = currentDay.format('YYYY-MM-DD');
            const dayOfWeek = currentDay.day();

            // Skip if lunch not configured for this day of week
            if (!lunchRangeDef.days.includes(dayOfWeek)) return;

            const dayEvents = eventsByDay[dayStr] || [];

            // Check if a manual Lunch event already exists for this day
            const hasExistingLunch = dayEvents.some(e => e.title?.toLowerCase() === 'lunch');
            if (hasExistingLunch) return;


            // Define Lunch Window for this day
            // Note: start/end in range definition are generic objects like { hour: 11, minute: 0 }
            let rStart = currentDay
                .hour(lunchRangeDef.start.hour)
                .minute(lunchRangeDef.start.minute)
                .second(0)
                .millisecond(0);

            let rEnd = currentDay
                .hour(lunchRangeDef.end.hour)
                .minute(lunchRangeDef.end.minute)
                .second(0)
                .millisecond(0);

            if (rEnd.isBefore(rStart)) {
                rEnd = rEnd.add(1, 'day');
            }

            // Search for best 60m slot using shared utility
            const bestSlot = findBestSlot(currentDay, lunchRangeDef, dayEvents, eventFlags, 60);

            if (bestSlot) {
                // Tier 1 & 2: No penalty. Tier 3: +1 penalty.
                if (bestSlot.tier === 3) {
                    dayDifficulties[dayStr] = (dayDifficulties[dayStr] || 0) + 1;
                }

                lunchEvents.push({
                    title: 'Lunch (Suggested)',
                    start: bestSlot.start.toDate(),
                    end: bestSlot.start.add(60, 'minute').toDate(),
                    color: lunchRangeDef.color,
                    type: 'generated',
                    typeTag: 'LUNCH_SUGGESTION',
                    // Pass the range ID or some ref if needed
                });

            } else {
                // Missed Lunch -> +2 penalty
                dayDifficulties[dayStr] = (dayDifficulties[dayStr] || 0) + 2;

                // Optional: Place a marker to show missed lunch?
                // "If lunch wasnt placed — +2"
                // Design says: "Shows missed if impossible." in verification.
                // Spec says: "THEN a 'Missed Lunch' marker is created at the end of the range"
                lunchEvents.push({
                    title: 'Missed Lunch',
                    start: rEnd.toDate(),
                    end: rEnd.toDate(),
                    type: 'marker',
                    color: '#ef4444', // Red warning
                    typeTag: 'LUNCH_MISSED'
                });
            }
        });

        return { lunchEvents, dayDifficulties };

    }, [events, dateRange, ranges, eventFlags]);
}
