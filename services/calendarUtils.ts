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
            uniqueEventsMap.set(key, event);
        } else {
            // Duplicate found
            const existingCalId = existing.calendarId;
            const newCalId = event.calendarId;

            // Log the duplicate discovery
            // console.log(`[EventMerge] Found duplicate event: "${event.title}"`);
            // console.log(`[EventMerge] Existing Cal: ${existingCalId}, New Cal: ${newCalId}, Priority: ${priorityCalendarId}`);

            if (priorityCalendarId && String(event.calendarId) === String(priorityCalendarId)) {
                // Overwrite existing if current event is from the priority calendar
                // Using String() conversion to ensure matches regardless of ID format (number/string)
                console.log(`[EventMerge] -> SWAPPING for priority calendar: ${event.title}`);
                uniqueEventsMap.set(key, event);
            } else {
                // console.log(`[EventMerge] -> Keeping existing (New is not priority): ${event.title} (Existing: ${existingCalId})`);
            }
        }
    }

    return Array.from(uniqueEventsMap.values());
};
