import { mergeDuplicateEvents } from './calendarService';
import * as Calendar from 'expo-calendar';

// Mock helper
const createEvent = (id: string, title: string, startDate: string, endDate: string): Calendar.Event => ({
    id,
    title,
    startDate,
    endDate,
    calendarId: 'cal1',
    timeZone: 'UTC',
    endTimeZone: 'UTC',
    allDay: false,
    accessLevel: Calendar.EventAccessLevel.PUBLIC,
    availability: Calendar.Availability.BUSY,
} as unknown as Calendar.Event);

describe('mergeDuplicateEvents', () => {
    it('should return empty array for empty input', () => {
        expect(mergeDuplicateEvents([])).toEqual([]);
    });

    it('should return same events if no duplicates', () => {
        const events = [
            createEvent('1', 'A', '2023-01-01', '2023-01-02'),
            createEvent('2', 'B', '2023-01-03', '2023-01-04')
        ];
        expect(mergeDuplicateEvents(events)).toEqual(events);
    });

    it('should merge identical events', () => {
        const e1 = createEvent('1', 'A', '2023-01-01', '2023-01-02');
        const e2 = createEvent('2', 'A', '2023-01-01', '2023-01-02'); // Duplicate

        const result = mergeDuplicateEvents([e1, e2]);
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(e1); // Should preserve first one
    });

    it('should not merge if title differs', () => {
        const e1 = createEvent('1', 'A', '2023-01-01', '2023-01-02');
        const e2 = createEvent('2', 'B', '2023-01-01', '2023-01-02');

        expect(mergeDuplicateEvents([e1, e2])).toHaveLength(2);
    });

    it('should not merge if time differs', () => {
        const e1 = createEvent('1', 'A', '2023-01-01', '2023-01-02');
        const e2 = createEvent('2', 'A', '2023-01-01', '2023-01-03');

        expect(mergeDuplicateEvents([e1, e2])).toHaveLength(2);
    });
});
