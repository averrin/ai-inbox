import dayjs from 'dayjs';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';

export interface DifficultyResult {
    base: number;
    bonus: number;
    total: number;
    reasons: string[];
}

export const calculateEventDifficulty = (
    event: { title: string; start: Date; end: Date },
    baseDifficulty: number,
    ranges: TimeRangeDefinition[],
    flags?: { isEnglish?: boolean; movable?: boolean; skippable?: boolean }
): DifficultyResult => {
    if (baseDifficulty === 0) {
        return {
            base: 0,
            bonus: 0,
            total: 0,
            reasons: []
        };
    }

    const reasons: string[] = [];
    let bonus = 0;

    // 0. Check for English flag
    if (flags?.isEnglish) {
        reasons.push("English Event");
        bonus += 1;
    }

    const evtStart = dayjs(event.start);
    const evtEnd = dayjs(event.end);

    // REMOVED: Check for intersection with Non-Work ranges (isWork = false)
    // The user requested to remove "intersect with" reason.

    // 2. Check for intersection with "Outside Work Hours"
    const workRanges = ranges.filter(r => r.isEnabled && r.isWork);
    if (workRanges.length > 0) {
        const relevantWorkIntervals: { start: dayjs.Dayjs, end: dayjs.Dayjs }[] = [];

        let curr = evtStart.startOf('day');
        const endDay = evtEnd.endOf('day');

        while (curr.isBefore(endDay) || curr.isSame(endDay)) {
            const d = curr.day();
            workRanges.forEach(range => {
                if (range.days.includes(d)) {
                    const rStart = curr.hour(range.start.hour).minute(range.start.minute).second(0);
                    let rEnd = curr.hour(range.end.hour).minute(range.end.minute).second(0);
                    if (rEnd.isBefore(rStart)) rEnd = rEnd.add(1, 'day');

                    // Intersection with event
                    const intStart = rStart.isAfter(evtStart) ? rStart : evtStart;
                    const intEnd = rEnd.isBefore(evtEnd) ? rEnd : evtEnd;

                    if (intStart.isBefore(intEnd)) {
                        relevantWorkIntervals.push({ start: intStart, end: intEnd });
                    }
                }
            });
            curr = curr.add(1, 'day');
        }

        relevantWorkIntervals.sort((a, b) => a.start.valueOf() - b.start.valueOf());

        const merged: { start: dayjs.Dayjs, end: dayjs.Dayjs }[] = [];
        if (relevantWorkIntervals.length > 0) {
            let currentInt = relevantWorkIntervals[0];
            for (let i = 1; i < relevantWorkIntervals.length; i++) {
                if (relevantWorkIntervals[i].start.isBefore(currentInt.end) || relevantWorkIntervals[i].start.isSame(currentInt.end)) {
                    if (relevantWorkIntervals[i].end.isAfter(currentInt.end)) {
                        currentInt.end = relevantWorkIntervals[i].end;
                    }
                } else {
                    merged.push(currentInt);
                    currentInt = relevantWorkIntervals[i];
                }
            }
            merged.push(currentInt);
        }

        let coveredDuration = 0;
        merged.forEach(m => {
            coveredDuration += m.end.diff(m.start);
        });

        const eventDuration = evtEnd.diff(evtStart);

        // Allow a small margin of error (e.g. 1 minute) for floating point/date math issues?
        // dayjs diff is fairly reliable for milliseconds/minutes.
        if (coveredDuration < eventDuration) {
            const reason = "Outside Work Hours";
            if (!reasons.includes(reason)) {
                reasons.push(reason);
                bonus += 1;
            }
        }
    }

    return {
        base: baseDifficulty,
        bonus,
        total: baseDifficulty + bonus,
        reasons
    };
};

export type DayStatusLevel = 'healthy' | 'moderate' | 'busy' | 'overloaded';

export const calculateDayStatus = (totalDifficulty: number, totalHours: number): DayStatusLevel => {
    // 1. Determine Level from Hours (Hard floors)
    let hourLevel = 0;
    if (totalHours < 1) hourLevel = 0;
    else if (totalHours < 3) hourLevel = 1;
    else if (totalHours < 5) hourLevel = 2; // Busy floor
    else hourLevel = 3; // Overloaded floor

    // 2. Determine Level from Difficulty
    let diffLevel = 0;
    if (totalDifficulty < 3) diffLevel = 0;
    else if (totalDifficulty < 6) diffLevel = 1;
    else if (totalDifficulty < 9) diffLevel = 2;
    else diffLevel = 3;

    // 3. Final Level is Max
    const level = Math.max(hourLevel, diffLevel);

    switch (level) {
        case 0: return 'healthy';
        case 1: return 'moderate';
        case 2: return 'busy';
        case 3: return 'overloaded';
        default: return 'overloaded';
    }
};

export interface DayBreakdown {
    totalScore: number;
    deepWorkMinutes: number;
    eventCount: number;
    breakdown: {
        [type: string]: { count: number; score: number };
    };
    penalties: {
        reason: string;
        points: number;
        count: number;
    }[];
}

export const aggregateDayStats = (events: any[]): DayBreakdown => {
    let totalScore = 0;
    let deepWorkMinutes = 0;
    let eventCount = 0;
    const breakdown: DayBreakdown['breakdown'] = {};
    const penaltiesMap: Record<string, { points: number; count: number }> = {};

    events.forEach(event => {
        // Skip lunch suggestions for score? Or include them?
        // Lunch suggestions usually have penalties associated with the DAY not the event itself sometimes?
        // Actually, penalties are usually attached to the event difficulty.

        if (event.difficulty) {
            totalScore += event.difficulty.total || 0;

            // Track Breakdown by Type
            const type = event.typeTag || 'Other';
            if (!breakdown[type]) breakdown[type] = { count: 0, score: 0 };
            breakdown[type].count++;
            breakdown[type].score += event.difficulty.total || 0;

            // Track Penalties/Bonuses
            // User requested to hide individual event bonus reasons in day summary.
            // Only day-level bonuses (lunch, focus) will be added manually in ScheduleScreen.

            /* 
            if (event.difficulty.reasons && event.difficulty.reasons.length > 0) {
                event.difficulty.reasons.forEach((r: string) => {
                    if (!penaltiesMap[r]) penaltiesMap[r] = { points: 0, count: 0 };
                    penaltiesMap[r].count++;
                });
            }
            */
        }

        // Deep Work Hours logic (approximate: based on difficulty > 0 or specific types?)
        // proposal says "deep work duration".
        // Usually deep work is considered events with difficulty > 0 or tracked explicitly.
        // Let's assume all events with difficulty > 0 count towards "Load".
        // Or strictly use the existing deep work calculation logic from ScheduleScreen.

        // Use logic from ScheduleScreen: if difficulty > 0, it counts.
        if (event.difficulty && event.difficulty.total > 0) {
            const start = dayjs(event.start);
            const end = dayjs(event.end);
            deepWorkMinutes += end.diff(start, 'minute');
            eventCount++;
        }
    });

    // Convert penalties map to array
    const penalties = Object.entries(penaltiesMap).map(([reason, stats]) => ({
        reason,
        points: stats.points, // We are not tracking points accurately per reason yet
        count: stats.count
    }));

    return {
        totalScore,
        deepWorkMinutes,
        eventCount,
        breakdown,
        penalties
    };
};
