import dayjs from 'dayjs';

export interface AnalyzableEvent {
    start: Date | string;
    end: Date | string;
    difficulty?: {
        total: number;
    };
    type?: string;
    [key: string]: any;
}

export interface WorkRange {
    start: Date | string;
    end: Date | string;
    [key: string]: any;
}

// Helper: cluster events for focus time
export const detectFocusRanges = (allEvents: AnalyzableEvent[]) => {
    // 1. Filter events with difficulty > 0
    // And exclude ranges/markers if any are in 'events'
    const candidates = allEvents.filter(e =>
        (e.difficulty && e.difficulty.total > 0) &&
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
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        // Cluster
        let cluster: typeof candidates = [];

        const flush = () => {
            if (cluster.length > 0) {
                const start = cluster[0].start;
                // Find max end
                let end = cluster[0].end;
                cluster.forEach(c => { if (dayjs(c.end).isAfter(dayjs(end))) end = c.end; });

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
                        start: start instanceof Date ? start : new Date(start), // Ensure Date
                        end: finalEnd instanceof Date ? finalEnd : new Date(finalEnd),
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

// Helper: detect free time zones (gaps > 60m between difficulty >= 1 events)
// Restricted to within provided workRanges
export const detectFreeTimeZones = (allEvents: AnalyzableEvent[], workRanges: WorkRange[] = []) => {
    // 1. Filter events with difficulty >= 1 (Busy events)
    // Ignore internal types
    const busyEvents = allEvents.filter(e =>
        (e.difficulty && e.difficulty.total >= 1) &&
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
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

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
