import dayjs from 'dayjs';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';

export interface BestSlotResult {
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
    tier: number; // 1: Perfect, 2: Skippable, 3: Movable
}

/**
 * Finds the best available slot within a range for a given duration.
 * Reuses the heuristic from useLunchSuggestion.
 */
export function findBestSlot(
    date: dayjs.Dayjs | string | Date,
    rangeDef: TimeRangeDefinition,
    busyEvents: any[],
    eventFlags: Record<string, { skippable?: boolean; movable?: boolean }>,
    durationMinutes: number = 60
): BestSlotResult | null {
    const currentDay = dayjs(date);
    const dayStr = currentDay.format('YYYY-MM-DD');

    // Define search window
    let rStart = currentDay
        .hour(rangeDef.start.hour)
        .minute(rangeDef.start.minute)
        .second(0)
        .millisecond(0);

    let rEnd = currentDay
        .hour(rangeDef.end.hour)
        .minute(rangeDef.end.minute)
        .second(0)
        .millisecond(0);

    if (rEnd.isBefore(rStart)) {
        rEnd = rEnd.add(1, 'day');
    }

    let bestSlot: BestSlotResult | null = null;

    // Search for best slot
    const maxIterations = 288; // Safety break
    let iterations = 0;

    for (let t = rStart; t.isBefore(rEnd.subtract(durationMinutes - 1, 'minute')) && iterations < maxIterations; t = t.add(5, 'minute')) {
        iterations++;
        const slotStart = t;
        const slotEnd = t.add(durationMinutes, 'minute');

        // Check overlaps
        const overlaps = busyEvents.filter(e => {
            if (e.type === 'marker' || e.type === 'zone' || e.type === 'range') return false;

            // For virtual events (like lunch suggestion), we treat them as hard busy if they are not the same type
            // But usually we just want to avoid intersection

            const eStart = dayjs(e.start);
            const eEnd = dayjs(e.end);

            return eStart.isBefore(slotEnd) && eEnd.isAfter(slotStart);
        });

        if (overlaps.length === 0) {
            return { start: slotStart, end: slotEnd, tier: 1 };
        }

        // Check if all overlaps are skippable
        const allSkippable = overlaps.every(e => {
            const flags = eventFlags[e.title] || {};
            return flags.skippable || e.isSkippable;
        });

        if (allSkippable) {
            if (!bestSlot || bestSlot.tier > 2) {
                bestSlot = { start: slotStart, end: slotEnd, tier: 2 };
            }
            continue;
        }

        // Check if all overlaps are movable
        const allMovable = overlaps.every(e => {
            const flags = eventFlags[e.title] || {};
            return flags.movable || e.movable;
        });

        if (allMovable) {
            if (!bestSlot || bestSlot.tier > 3) {
                bestSlot = { start: slotStart, end: slotEnd, tier: 3 };
            }
            continue;
        }
    }

    return bestSlot;
}
