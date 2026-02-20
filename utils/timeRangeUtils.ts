import dayjs, { Dayjs } from 'dayjs';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';

export function isInInvisibleRange(ranges: TimeRangeDefinition[], now?: Dayjs): boolean {
    const currentTime = now || dayjs();
    const currentDay = currentTime.day(); // 0-6 (Sun-Sat)

    // Find any range that:
    // 1. Is enabled
    // 2. Is NOT visible
    // 3. Includes today
    // 4. Includes current time
    // 5. Is NOT 'Walk' (special case)

    return ranges.some(range => {
        if (!range.isEnabled) return false;
        if (range.isVisible !== false) return false; // Default is true if undefined
        if (range.title === 'Walk') return false;
        if (!range.days.includes(currentDay)) return false;

        const nowMins = currentTime.hour() * 60 + currentTime.minute();
        const startMins = range.start.hour * 60 + range.start.minute;
        const endMins = range.end.hour * 60 + range.end.minute;

        if (endMins < startMins) {
            // Overnight (e.g. 23:00 - 07:00)
            // In range if time is >= 23:00 OR < 07:00
            return nowMins >= startMins || nowMins < endMins;
        } else {
            // Same day (e.g. 09:00 - 17:00)
            return nowMins >= startMins && nowMins < endMins;
        }
    });
}
