import dayjs from 'dayjs';
import { Colors } from '../../../ui/design-tokens';

// Helper: cluster events for focus time
export const detectFocusRanges = (allEvents: any[]) => {
    // 1. Filter events with difficulty > 0
    // And exclude ranges/markers if any are in 'events'
    const candidates = allEvents.filter(e =>
        (e.difficulty?.total > 0 && !e.isSkippable) &&
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
        dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

        // Cluster
        let cluster: typeof candidates = [];

        const flush = () => {
            if (cluster.length > 0) {
                const start = cluster[0].start;
                // Find max end
                let end = cluster[0].end;
                cluster.forEach(c => { if (dayjs(c.end).isAfter(end)) end = c.end; });

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
                        start,
                        end: finalEnd,
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
};

// Helper: detect free time zones (gaps > 60m between difficulty >= 1 events)
// Restricted to within provided workRanges
export const detectFreeTimeZones = (allEvents: any[], workRanges: any[] = []) => {
    // 1. Filter events with difficulty >= 1 (Busy events)
    // Ignore internal types unless they are zones marked as non-free
    const busyEvents = allEvents.filter(e => {
        if (e.type === 'zone') {
            const content = e.originalEvent?.content || e.originalEvent?.notes || '';
            if (content.includes('[nonFree::true]')) return true;
        }
        return (e.difficulty?.total >= 1) && !e.type;
    });

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
        dayEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

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
};

export const getEventCellStyle = (event: any, workRanges: any[], completedEvents: Record<string, boolean>) => {
    const now = dayjs();
    const eventEnd = dayjs(event.end);
    const isFinishedToday = now.isSame(event.start, 'day') && now.isAfter(eventEnd);

    // Compute isCompleted from store at render time
    const completedKey = `${event.title}::${dayjs(event.start).format('YYYY-MM-DD')}`;
    const isEventCompleted = event.completable && !!completedEvents[completedKey];

    // Completable: overdue (past today, not completed) => full opacity, red border + glow
    const isOverdueCompletable = event.completable && !isEventCompleted && isFinishedToday;
    // Completable: completed => dimmed
    const isCompletedEvent = isEventCompleted;

    const style: any = {
        backgroundColor: event.isInverted ? Colors.background : (event.color || '#4f46e5'),
        borderColor: event.isInverted ? (event.color || '#4f46e5') : '#eeeeee66',
        borderWidth: 1,
        borderRadius: 4,
        opacity: isCompletedEvent ? 0.35 : isOverdueCompletable ? 0.9 : (event.isSkippable || isFinishedToday) ? 0.45 : (event.isInverted ? 0.95 : 0.7),
        marginTop: -1
    };

    if (isOverdueCompletable) {
        style.borderColor = Colors.error;
        style.borderWidth = 2;
        style.shadowColor = Colors.error;
        style.shadowOffset = { width: 0, height: 4 };
        style.shadowOpacity = 0.8;
        style.shadowRadius = 12;
        style.elevation = 10;
        style.boxShadow = '0 4px 24px #ef444488';
    }

    // Highlight events outside work hours (red dashed border)
    if (!isOverdueCompletable && workRanges.length > 0 && !event.type && (event.difficulty?.total || 0) > 0) {
        const evtStart = dayjs(event.start);
        const evtEnd = dayjs(event.end);

        const isDuringWork = workRanges.some((range: any) => {
            const rangeStart = dayjs(range.start);
            const rangeEnd = dayjs(range.end);
            return evtStart.isBefore(rangeEnd) && evtEnd.isAfter(rangeStart);
        });

        if (!isDuringWork) {
            style.borderColor = 'red';
            style.borderWidth = 2;
            style.borderStyle = 'dashed';
        }
    }
    return style;
};
