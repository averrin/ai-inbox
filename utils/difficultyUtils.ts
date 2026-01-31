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
    flags?: { isEnglish?: boolean; movable?: boolean }
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
