import { Event } from 'expo-calendar';

/**
 * Merges duplicate events based on strict equality of title, startDate, and endDate.
 * Returns a new array with duplicates removed.
 */
export const mergeDuplicateEvents = (events: Event[]): Event[] => {
    const uniqueEvents: Event[] = [];
    const seen = new Set<string>();

    for (const event of events) {
        // Create a unique key based on title, start, and end time
        // Using strict equality as per design
        const key = `${event.title}|${event.startDate}|${event.endDate}`;

        if (!seen.has(key)) {
            seen.add(key);
            uniqueEvents.push(event);
        }
    }

    return uniqueEvents;
};
