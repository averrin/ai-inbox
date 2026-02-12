import dayjs from 'dayjs';
import { detectFocusRanges, detectFreeTimeZones, AnalyzableEvent, WorkRange } from './scheduleAnalysis';

const runTest = async (name: string, fn: () => Promise<void> | void) => {
    try {
        await fn();
        console.log(`PASS: ${name}`);
    } catch (e: any) {
        console.error(`FAIL: ${name}`, e);
        process.exit(1);
    }
};

const assert = (condition: boolean, message: string) => {
    if (!condition) {
        throw new Error(message);
    }
};

(async () => {
    await runTest('detectFocusRanges: clusters connected events', () => {
        const start = dayjs().set('hour', 9).set('minute', 0).toDate();
        // 9:00 - 10:00
        const evt1: AnalyzableEvent = {
            start: start,
            end: dayjs(start).add(60, 'minute').toDate(),
            difficulty: { total: 1 },
            title: 'Task 1'
        };
        // 10:10 - 11:00 (10 min gap, should merge)
        const evt2: AnalyzableEvent = {
            start: dayjs(start).add(70, 'minute').toDate(),
            end: dayjs(start).add(120, 'minute').toDate(),
            difficulty: { total: 1 },
            title: 'Task 2'
        };

        const events = [evt1, evt2];
        const result = detectFocusRanges(events);

        // Total duration: 9:00 to 11:00 is 120 mins.
        // Wait, logic says:
        // gap between evt2 start (70m) and evt1 end (60m) is 10m <= 15m. So merged.
        // Cluster start: 0m. Cluster end: 120m. Duration 120m > 60m.
        // Should return 1 range.

        assert(result.length === 1, `Expected 1 range, got ${result.length}`);
        assert(result[0].title === 'Focus Time', 'Title should be Focus Time');
        assert(dayjs(result[0].start).isSame(evt1.start), 'Start time matches');
        assert(dayjs(result[0].end).isSame(evt2.end), 'End time matches');
    });

    await runTest('detectFocusRanges: breaks on large gap', () => {
        const start = dayjs().set('hour', 9).set('minute', 0).toDate();
        // 9:00 - 10:00
        const evt1: AnalyzableEvent = {
            start: start,
            end: dayjs(start).add(60, 'minute').toDate(),
            difficulty: { total: 1 },
            title: 'Task 1'
        };
        // 10:30 - 11:30 (30 min gap, should NOT merge)
        const evt2: AnalyzableEvent = {
            start: dayjs(start).add(90, 'minute').toDate(),
            end: dayjs(start).add(150, 'minute').toDate(),
            difficulty: { total: 1 },
            title: 'Task 2'
        };

        // Each is 60 mins. Logic: duration > 60.
        // evt1: 60m. Condition: duration > 60. 60 is not > 60. So ignored?
        // Wait, "if (duration > 60)"
        // Let's check logic: dayjs diff in minutes.
        // If exact 60, it returns nothing.
        // Let's make them 61 mins.

        const evt1_long = { ...evt1, end: dayjs(start).add(61, 'minute').toDate() };
        const evt2_long = { ...evt2, end: dayjs(start).add(151, 'minute').toDate() };

        const events = [evt1_long, evt2_long];
        const result = detectFocusRanges(events);

        // Should be 2 ranges.
        assert(result.length === 2, `Expected 2 ranges, got ${result.length}`);
    });

    await runTest('detectFreeTimeZones: identifies gaps', () => {
        const start = dayjs().set('hour', 9).set('minute', 0).toDate(); // 9:00
        const end = dayjs().set('hour', 17).set('minute', 0).toDate(); // 17:00

        const workRanges: WorkRange[] = [{
            start: start,
            end: end
        }];

        // Busy event at 9:00 - 10:00
        const evt1: AnalyzableEvent = {
            start: start,
            end: dayjs(start).add(60, 'minute').toDate(),
            difficulty: { total: 1 },
            title: 'Busy 1'
        };

        // Busy event at 13:00 - 14:00
        const evt2: AnalyzableEvent = {
            start: dayjs(start).add(240, 'minute').toDate(), // 9:00 + 4h = 13:00
            end: dayjs(start).add(300, 'minute').toDate(), // 14:00
            difficulty: { total: 1 },
            title: 'Busy 2'
        };

        // Gap 1: 10:00 to 13:00 (3 hours). Should be detected.
        // Gap 2: 14:00 to 17:00 (3 hours). Should be detected.

        const result = detectFreeTimeZones([evt1, evt2], workRanges);

        assert(result.length === 2, `Expected 2 free time zones, got ${result.length}`);

        // Check first zone
        const zone1 = result[0];
        // Should be 10:00 to 13:00
        const expectedStart1 = evt1.end;
        const expectedEnd1 = evt2.start;

        assert(dayjs(zone1.start).isSame(expectedStart1), 'Zone 1 start matches');
        assert(dayjs(zone1.end).isSame(expectedEnd1), 'Zone 1 end matches');
    });

    console.log("All tests passed!");
})();
