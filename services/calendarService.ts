import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/settings';

export interface LocalCalendar extends Calendar.Calendar {
    selected?: boolean;
}

export const ensureCalendarPermissions = async (): Promise<boolean> => {
    const { status: calendarStatus } = await Calendar.requestCalendarPermissionsAsync();

    if (calendarStatus !== 'granted') {
        return false;
    }

    if (Platform.OS === 'ios') {
        const { status: remindersStatus } = await Calendar.requestRemindersPermissionsAsync();
        if (remindersStatus !== 'granted') {
            return false;
        }
    }

    return true;
};

export const getWritableCalendars = async (): Promise<Calendar.Calendar[]> => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) return [];

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

    // Filter logic can be added here if we only want writable/specific types
    // For reading schedule, we usually want all visible calendars
    return calendars.filter(cal => cal.source.name !== 'AI Inbox'); // Exclude app's own if needed, or included.
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

    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    const { defaultOpenCalendarId } = useSettingsStore.getState();
    return mergeDuplicateEvents(events, defaultOpenCalendarId);
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

