import { Event } from 'expo-calendar';

/**
 * Merges duplicate events based on strict equality of title, startDate, and endDate.
 * If a priorityCalendarId is provided, the event from that calendar is preferred.
 */
export const mergeDuplicateEvents = (events: Event[], priorityCalendarId?: string | null): Event[] => {
    const uniqueEventsMap = new Map<string, Event>();

    for (const event of events) {
        // Use more robust key generation by normalizing dates if they are objects
        const start = new Date(event.startDate).getTime();
        const end = new Date(event.endDate).getTime();
        const key = `${event.title}|${start}|${end}`;

        const existing = uniqueEventsMap.get(key);
        if (!existing) {
            // Initialize mergedCalendarIds and ids with the current event's data
            (event as any).mergedCalendarIds = [event.calendarId];
            (event as any).ids = [event.id];
            uniqueEventsMap.set(key, event);
        } else {
            // Duplicate found
            const existingCalId = existing.calendarId;
            const newCalId = event.calendarId;
            const existingIds = (existing as any).ids || [existing.id];

            // Get existing merged IDs or initialize if missing (sanity check)
            const existingMergedIds = (existing as any).mergedCalendarIds || [existingCalId];

            // Deduplicate attendees
            const mergeAttendees = (a: any[] = [], b: any[] = []) => {
                const map = new Map();
                [...a, ...b].forEach(att => {
                    const key = att.email || att.name || JSON.stringify(att);
                    if (!map.has(key)) map.set(key, att);
                });
                return Array.from(map.values());
            };

            const existingAttendees = (existing as any).attendees || [];
            const newAttendees = (event as any).attendees || [];
            const mergedAttendees = mergeAttendees(existingAttendees, newAttendees);

            if (priorityCalendarId && String(event.calendarId) === String(priorityCalendarId)) {
                // Overwrite existing if current event is from the priority calendar
                // Transfer accumulated IDs to the new event
                (event as any).mergedCalendarIds = [...existingMergedIds, newCalId];
                (event as any).ids = [...existingIds, event.id];
                (event as any).attendees = mergedAttendees;
                uniqueEventsMap.set(key, event);
            } else {
                // Keep existing, but add the new calendar ID and event ID to it
                (existing as any).mergedCalendarIds = [...existingMergedIds, newCalId];
                (existing as any).ids = [...existingIds, event.id];
                (existing as any).attendees = mergedAttendees;
            }
        }
    }
    return Array.from(uniqueEventsMap.values());
};

/**
 * Parses an iCalendar RRULE string into an expo-calendar RecurrenceRule object.
 * Format: RRULE:FREQ=WEEKLY;BYDAY=MO,TU;INTERVAL=1;UNTIL=20231231T235959Z
 */
export const parseRRule = (rruleString: string): any => {
    if (!rruleString || !rruleString.startsWith('RRULE:')) return undefined;

    const parts = rruleString.substring(6).split(';');
    const rule: any = {};

    parts.forEach(part => {
        const [key, value] = part.split('=');
        if (!key || !value) return;

        switch (key.toUpperCase()) {
            case 'FREQ':
                const freqMap: Record<string, string> = {
                    'DAILY': 'daily',
                    'WEEKLY': 'weekly',
                    'MONTHLY': 'monthly',
                    'YEARLY': 'yearly'
                };
                rule.frequency = freqMap[value.toUpperCase()];
                break;
            case 'INTERVAL':
                rule.interval = parseInt(value, 10);
                break;
            case 'UNTIL':
                // Simple date parsing for UNTIL (YYYYMMDDTHHMMSSZ)
                const y = value.substring(0, 4);
                const m = value.substring(4, 6);
                const d = value.substring(6, 8);
                const h = value.substring(9, 11);
                const min = value.substring(11, 13);
                const s = value.substring(13, 15);
                rule.endDate = new Date(`${y}-${m}-${d}T${h || '00'}:${min || '00'}:${s || '00'}Z`);
                break;
            case 'COUNT':
                rule.occurrence = parseInt(value, 10);
                break;
            // Native expo-calendar doesn't support BYDAY/BYMONTH/etc easily in the same way, 
            // but for simple cases it's enough.
        }
    });

    return rule.frequency ? rule : undefined;
};
