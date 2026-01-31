import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

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

export const getCalendarEvents = async (
    calendarIds: string[],
    startDate: Date,
    endDate: Date
): Promise<Calendar.Event[]> => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission || calendarIds.length === 0) return [];

    const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
    return mergeDuplicateEvents(events);
};
