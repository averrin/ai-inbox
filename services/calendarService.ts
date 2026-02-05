import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/settings';

export interface LocalCalendar extends Calendar.Calendar {
    selected?: boolean;
}

export const ensureCalendarPermissions = async () => {
    try {
        const { status: currentStatus } = await Calendar.getCalendarPermissionsAsync();

        if (currentStatus === 'granted') return true;

        const { status: requestStatus } = await Calendar.requestCalendarPermissionsAsync();

        return requestStatus === 'granted';
    } catch (e) {
        console.error('[CalendarService] permission error:', e);
        return false;
    }
};

export const getWritableCalendars = async (): Promise<Calendar.Calendar[]> => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const cal of calendars) {
        try {
            await Calendar.getEventsAsync([cal.id], now, oneWeekLater);
        } catch (e) {
            // Ignore errors for individual calendar checks
        }
    }

    const filtered = calendars.filter(cal => cal.source?.name !== 'AI Inbox');
    return filtered;
};

import { mergeDuplicateEvents } from './calendarUtils';

export { mergeDuplicateEvents };

// ... existing export
export const getCalendarEvents = async (
    calendarIds: string[],
    startDate: Date,
    endDate: Date
): Promise<Calendar.Event[]> => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission || calendarIds.length === 0) return [];

    try {
        // Broaden range to ensure we catch events that might start before/end after the window but overlap
        // However, the original code used a very broad range for diagnostics (30 days). 
        // We'll stick to a reasonable buffer or the requested range.
        // For now, I'll keep the logic but remove the logs.
        const broadStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        const broadEnd = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        const events = await Calendar.getEventsAsync(calendarIds, broadStart, broadEnd);

        const { defaultOpenCalendarId } = useSettingsStore.getState();
        const merged = mergeDuplicateEvents(events, defaultOpenCalendarId);
        return merged;
    } catch (e) {
        console.error('[CalendarService] getEventsAsync FAILED:', e);
        return [];
    }
};

export const createCalendarEvent = async (calendarId: string, eventData: Partial<Calendar.Event>) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    // Cast to any to access attendees which might not be in the strict creation type but are passed
    const data = eventData as any;

    if (Platform.OS === 'android' && data.attendees && data.attendees.length > 0) {
        // Android requires separate attendee creation
        const { attendees, ...dataWithoutAttendees } = data;
        const newEventId = await Calendar.createEventAsync(calendarId, dataWithoutAttendees);

        // Add attendees separately
        // We iterate sequentially to ensure they are added
        for (const attendee of attendees) {
            try {
                await Calendar.createAttendeeAsync(newEventId, attendee);
            } catch (e) {
                console.warn(`Failed to add attendee ${attendee.email || 'unknown'}`, e);
            }
        }
        return newEventId;
    }

    return await Calendar.createEventAsync(calendarId, eventData);
};

export const getUpcomingEvents = async (days: number = 3): Promise<string> => {
    try {
        const hasPermission = await ensureCalendarPermissions();
        if (!hasPermission) return "No calendar permission";

        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + days);

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map(c => c.id);

        if (calendarIds.length === 0) return "No calendars found";

        const events = await Calendar.getEventsAsync(calendarIds, now, endDate);

        if (events.length === 0) return "No upcoming events";

        return events.map(e =>
            `- ${e.title} (${new Date(e.startDate).toLocaleString()})`
        ).join('\n');
    } catch (e) {
        console.warn("Error fetching upcoming events:", e);
        return `Error fetching events: ${e}`;
    }
};

export const updateEventRSVP = async (eventId: string, status: string, currentAttendees: any[]) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    // Find current user attendee
    const userAttendeeIndex = currentAttendees.findIndex(a => a.isCurrentUser);

    if (userAttendeeIndex === -1) {
        throw new Error("Current user is not an attendee of this event");
    }

    const updatedAttendees = [...currentAttendees];
    updatedAttendees[userAttendeeIndex] = {
        ...updatedAttendees[userAttendeeIndex],
        status: status
    };

    try {
        // @ts-ignore - 'attendees' is not in the type definition but is required for RSVP updates
        await Calendar.updateEventAsync(eventId, { attendees: updatedAttendees } as any);
    } catch (e) {
        console.error("Failed to update RSVP:", e);
        throw e;
    }
};
