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
            // Initialize mergedCalendarIds with the current event's calendarId
            (event as any).mergedCalendarIds = [event.calendarId];
            uniqueEventsMap.set(key, event);
        } else {
            // Duplicate found
            const existingCalId = existing.calendarId;
            const newCalId = event.calendarId;

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
                (event as any).attendees = mergedAttendees;
                // console.log(`[EventMerge] -> SWAPPING for priority calendar: ${event.title}`);
                uniqueEventsMap.set(key, event);
            } else {
                // Keep existing, but add the new calendar ID to it
                (existing as any).mergedCalendarIds = [...existingMergedIds, newCalId];
                (existing as any).attendees = mergedAttendees;
                // console.log(`[EventMerge] -> Keeping existing (New is not priority): ${event.title} (Existing: ${existingCalId})`);
            }
        }
    }

    return Array.from(uniqueEventsMap.values());
};
