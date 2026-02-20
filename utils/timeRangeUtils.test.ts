import { describe, it, expect } from "bun:test";
import dayjs from 'dayjs';
import { isInInvisibleRange } from './timeRangeUtils';

describe('isInInvisibleRange', () => {

    it('should return false if no ranges', () => {
        expect(isInInvisibleRange([])).toBe(false);
    });

    it('should return true if inside invisible range', () => {
        const now = dayjs();
        const ranges: any[] = [{
            id: '1',
            isEnabled: true,
            isVisible: false,
            title: 'Sleep',
            days: [0, 1, 2, 3, 4, 5, 6],
            start: { hour: now.hour(), minute: 0 },
            end: { hour: (now.hour() + 2) % 24, minute: 0 },
            color: 'blue'
        }];

        expect(isInInvisibleRange(ranges, now)).toBe(true);
    });

    it('should return false if inside visible range', () => {
        const now = dayjs();
        const ranges: any[] = [{
            id: '1',
            isEnabled: true,
            isVisible: true,
            title: 'Work',
            days: [0, 1, 2, 3, 4, 5, 6],
            start: { hour: now.hour(), minute: 0 },
            end: { hour: (now.hour() + 2) % 24, minute: 0 },
            color: 'blue'
        }];

        expect(isInInvisibleRange(ranges, now)).toBe(false);
    });

    it('should return false for Walk range even if invisible', () => {
        const now = dayjs();
        const ranges: any[] = [{
            id: '1',
            isEnabled: true,
            isVisible: false,
            title: 'Walk',
            days: [0, 1, 2, 3, 4, 5, 6],
            start: { hour: now.hour(), minute: 0 },
            end: { hour: (now.hour() + 2) % 24, minute: 0 },
            color: 'blue'
        }];

        expect(isInInvisibleRange(ranges, now)).toBe(false);
    });

    it('should handle overnight ranges correctly (current time inside)', () => {
        const now = dayjs();
        const currentHour = now.hour();

        const startH = (currentHour - 1 + 24) % 24;
        const endH = (currentHour - 2 + 24) % 24;

        const ranges: any[] = [{
            id: '1',
            isEnabled: true,
            isVisible: false,
            title: 'Overnight Invisible',
            days: [0, 1, 2, 3, 4, 5, 6],
            start: { hour: startH, minute: 0 },
            end: { hour: endH, minute: 0 },
            color: 'blue'
        }];

        expect(isInInvisibleRange(ranges, now)).toBe(true);
    });

     it('should handle overnight ranges correctly (current time outside)', () => {
        const now = dayjs();
        const currentHour = now.hour();

        const startH = (currentHour + 2) % 24;
        const endH = (currentHour - 2 + 24) % 24;

         const ranges: any[] = [{
            id: '1',
            isEnabled: true,
            isVisible: false,
            title: 'Overnight Outside',
            days: [0, 1, 2, 3, 4, 5, 6],
            start: { hour: startH, minute: 0 },
            end: { hour: endH, minute: 0 },
            color: 'blue'
        }];

        expect(isInInvisibleRange(ranges, now)).toBe(false);
     });
});
