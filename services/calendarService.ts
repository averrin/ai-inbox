import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { useSettingsStore } from '../store/settings';

export interface LocalCalendar extends Calendar.Calendar {
    selected?: boolean;
}

export const ensureCalendarPermissions = async () => {
    console.log('[CalendarService] checking permissions status...');
    try {
        const { status: currentStatus } = await Calendar.getCalendarPermissionsAsync();
        console.log('[CalendarService] current permission status:', currentStatus);

        if (currentStatus === 'granted') return true;

        console.log('[CalendarService] requesting permissions...');
        const { status: requestStatus } = await Calendar.requestCalendarPermissionsAsync();
        console.log('[CalendarService] request permission status:', requestStatus);

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
    console.log('[CalendarService] getWritableCalendars: found', calendars.length, 'total calendars');

    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const cal of calendars) {
        let eventCount = 'N/A';
        try {
            const evts = await Calendar.getEventsAsync([cal.id], now, oneWeekLater);
            eventCount = `${evts.length}`;

            // Experimental Diagnostic: If 0 events found, try to create one just to test access
            if (evts.length === 0 && cal.accessLevel === 'owner' && cal.title.includes('Alex Nabrodov')) {
                console.log(`[CalendarService] Diagnostic: Found zero events but isPrimary=${cal.isPrimary}, isVisible=${cal.isVisible}. Attempting to FORCE isVisible: true...`);

                if (!cal.isVisible) {
                    try {
                        await Calendar.updateCalendarAsync(cal.id, {
                            isVisible: true
                        });
                        console.log(`[CalendarService] Diagnostic: updateCalendarAsync(isVisible: true) success for ${cal.id}`);

                        // Check if it actually stuck
                        const recheck = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
                        const updatedCal = recheck.find(c => c.id === cal.id);
                        console.log(`[CalendarService] Diagnostic: Re-checked visibility for ${cal.id}: ${updatedCal?.isVisible}`);
                    } catch (updateErr) {
                        console.error(`[CalendarService] Diagnostic: updateCalendarAsync FAILED:`, updateErr);
                    }
                }

                console.log(`[CalendarService] Diagnostic: Attempting to create test event in calendar ${cal.id}...`);
                const testEventId = await Calendar.createEventAsync(cal.id, {
                    title: 'AI Inbox Test Event',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 3600000), // 1 hour
                    timeZone: 'UTC'
                });
                console.log(`[CalendarService] Diagnostic: Created test event with ID: ${testEventId}`);

                // Log full calendar object for comparison
                console.log(`[CalendarService] Diagnostic: Calendar Metadata for ${cal.id}:`, JSON.stringify(cal, null, 2));

                // Fetch again to see if it's there
                const retryEvts = await Calendar.getEventsAsync([cal.id], new Date(Date.now() - 3600000), new Date(Date.now() + 7200000));
                console.log(`[CalendarService] Diagnostic: Retry fetch count: ${retryEvts.length}`);

                // Cleanup
                await Calendar.deleteEventAsync(testEventId);
                console.log(`[CalendarService] Diagnostic: Deleted test event.`);
            }
        } catch (e) {
            eventCount = `ERROR: ${e}`;
        }
        if (cal.id === '7') {
            console.log(`[CalendarService] Diagnostic: Working Calendar Metadata (ID 7):`, JSON.stringify(cal, null, 2));
        }
        console.log(`[CalendarService]   - [${cal.id}] ${cal.title} (Source: ${cal.source?.name}, Access: ${cal.accessLevel}) -> Events (1wk): ${eventCount}`);
    }

    const filtered = calendars.filter(cal => cal.source?.name !== 'AI Inbox');
    console.log('[CalendarService] count after filtering AI Inbox:', filtered.length);
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
    console.log('[CalendarService] getCalendarEvents: entered, IDs:', JSON.stringify(calendarIds));
    const hasPermission = await ensureCalendarPermissions();
    console.log('[CalendarService] hasPermission:', hasPermission);
    if (!hasPermission || calendarIds.length === 0) return [];

    console.log('[CalendarService] Fetching events for IDs:', calendarIds.length, 'range:', startDate, 'to', endDate);

    // Diagnostic: Check visibility and try to force it for problematic IDs
    const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    for (const id of calendarIds) {
        const cal = allCals.find(c => c.id === id);
        if (cal && !cal.isVisible) {
            console.log(`[CalendarService] Diagnostic: ID ${id} (${cal.title}) is HIDDEN. Attempting to force visible...`);
            try {
                await Calendar.updateCalendarAsync(id, { isVisible: true });
                console.log(`[CalendarService] Diagnostic: Force visibility success for ${id}`);
            } catch (e) {
                console.error(`[CalendarService] Diagnostic: Force visibility FAILED for ${id}:`, e);
            }
        }
    }

    try {
        // Broaden range for diagnostic - fetch +/- 30 days just to see if anything pops up
        const broadStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        const broadEnd = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        console.log('[CalendarService] Diagnostic: fetching with broad range:', broadStart.toISOString(), 'to', broadEnd.toISOString());

        const events = await Calendar.getEventsAsync(calendarIds, broadStart, broadEnd);

        console.log('[CalendarService] getEventsAsync success, count:', events.length);

        // Diagnostic: If 0 events, try to create and fetch immediately
        if (events.length === 0 && calendarIds.includes('18')) {
            console.log('[CalendarService] Diagnostic: 0 events for work ID 18. Attempting create-and-fetch test...');
            try {
                const testId = await Calendar.createEventAsync('18', {
                    title: 'DEBUG TEST EVENT',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 3600000),
                    timeZone: 'UTC'
                });
                const retry = await Calendar.getEventsAsync(['18'], broadStart, broadEnd);
                console.log(`[CalendarService] Diagnostic: Create success (ID: ${testId}), Retry fetch count: ${retry.length}`);
                await Calendar.deleteEventAsync(testId);
            } catch (e) {
                console.error('[CalendarService] Diagnostic: Create-and-fetch FAILED:', e);
            }
        }

        if (events.length === 0) {
            console.log('[CalendarService] WARNING: Zero events returned even with broad range for IDs:', calendarIds);
        } else {
            // Log first event to see what it looks like
            console.log('[CalendarService] Sample event:', JSON.stringify({
                title: events[0].title,
                start: events[0].startDate,
                end: events[0].endDate,
                cid: events[0].calendarId
            }));
        }

        const { defaultOpenCalendarId } = useSettingsStore.getState();
        const merged = mergeDuplicateEvents(events, defaultOpenCalendarId);
        console.log('[CalendarService] Merged events count:', merged.length);
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
