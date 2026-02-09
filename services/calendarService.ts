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

import { mergeDuplicateEvents, parseRRule } from './calendarUtils';

export { mergeDuplicateEvents, parseRRule };

// ... existing export
export const getCalendarEvents = async (
    calendarIds: string[],
    startDate: Date,
    endDate: Date
): Promise<Calendar.Event[]> => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission || calendarIds.length === 0) return [];

    try {
        // Debug: Check calendar metadata to see if it's synced
        if (Platform.OS === 'android') {
            const allCals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            const targetCals = allCals.filter(c => calendarIds.includes(c.id));
            // console.log('[CalendarService] Target Calendars Metadata:', JSON.stringify(targetCals.map(c => ({
            //     id: c.id,
            //     title: c.title,
            //     isSynced: (c as any).isSynced,
            //     isVisible: c.isVisible,
            //     accessLevel: c.accessLevel,
            //     source: c.source
            // })), null, 2));
        }

        // Use exact dates for fetching
        const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);
        // console.log(`[CalendarService] Raw fetch returned ${events.length} events for IDs: ${calendarIds}`);
        const eventCounts = events.reduce((acc: any, e) => {
            acc[e.calendarId] = (acc[e.calendarId] || 0) + 1;
            return acc;
        }, {});
        // console.log('[CalendarService] Events per calendar:', JSON.stringify(eventCounts));

        const { defaultOpenCalendarId } = useSettingsStore.getState();
        const merged = mergeDuplicateEvents(events, defaultOpenCalendarId);

        // Filter events strictly to the requested window (getEventsAsync sometimes returns overlapping ones)
        const filtered = merged.filter(evt => {
            const evStart = new Date(evt.startDate).getTime();
            const evEnd = new Date(evt.endDate).getTime();
            const winStart = startDate.getTime();
            const winEnd = endDate.getTime();
            return (evStart < winEnd && evEnd > winStart);
        });

        // Android fix: getEventsAsync doesn't return attendees, fetch them for each merged event
        if (Platform.OS === 'android') {
            await Promise.all(filtered.map(async (evt) => {
                try {
                    const attendees = await Calendar.getAttendeesForEventAsync(evt.id);
                    (evt as any).attendees = attendees || [];
                } catch (e) {
                    // Silently fail for individual events
                }
            }));
        }

        return filtered;
    } catch (e) {
        console.error('[CalendarService] getEventsAsync FAILED:', e);
        return [];
    }
};
export const getAttendeesForEvent = async (eventId: string): Promise<Calendar.Attendee[]> => {
    if (Platform.OS !== 'android') return [];
    try {
        return await Calendar.getAttendeesForEventAsync(eventId);
    } catch (e) {
        console.error(`[CalendarService] Failed to fetch attendees for ${eventId}:`, e);
        return [];
    }
};

export const createCalendarEvent = async (calendarId: string, eventData: Partial<Calendar.Event>) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    // Cast to any to access extra fields (attendees, recurrence)
    const data = eventData as any;
    const { workAccountId } = useSettingsStore.getState();

    // Auto-invite work account for work/lunch events
    if ((data.isWork || data.tags?.includes('lunch')) && workAccountId) {
        if (!data.attendees) data.attendees = [];
        const alreadyAdded = data.attendees.some((a: any) => a.email?.toLowerCase() === workAccountId.toLowerCase());
        if (!alreadyAdded) {
            data.attendees.push({
                email: workAccountId,
                role: 'attendee',
                status: 'pending',
                type: 'person'
            });
        }
    }

    // Prepare data for native call - ensure dates are Date objects
    const nativeEventData: Partial<Calendar.Event> = {
        title: eventData.title,
        startDate: eventData.startDate ? new Date(eventData.startDate) : new Date(),
        endDate: eventData.endDate ? new Date(eventData.endDate) : new Date(),
        notes: (eventData as any).description || (eventData as any).notes,
        allDay: eventData.allDay,
        location: eventData.location,
        alarms: eventData.alarms,
    };

    const sDate = new Date(nativeEventData.startDate!);
    const eDate = new Date(nativeEventData.endDate!);

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
        throw new Error("Invalid event dates");
    }

    // Handle recurrence
    if (data.recurrenceRule) {
        // Direct object passed
        nativeEventData.recurrenceRule = data.recurrenceRule;
    } else if (data.recurrence) {
        if (Array.isArray(data.recurrence)) {
            // Google format is array of strings
            const rule = parseRRule(data.recurrence[0]);
            if (rule) nativeEventData.recurrenceRule = rule;
        } else if (typeof data.recurrence === 'string') {
            const rule = parseRRule(data.recurrence);
            if (rule) nativeEventData.recurrenceRule = rule;
        }
    }

    try {
        if (Platform.OS === 'android' && data.attendees && data.attendees.length > 0) {
            // Android requires separate attendee creation
            const newEventId = await Calendar.createEventAsync(calendarId, nativeEventData);

            // Add attendees separately
            for (const attendee of data.attendees) {
                try {
                    await Calendar.createAttendeeAsync(newEventId, attendee);
                } catch (e) {
                    console.warn(`Failed to add attendee ${attendee.email || 'unknown'}`, e);
                }
            }
            return newEventId;
        }

        return await Calendar.createEventAsync(calendarId, nativeEventData);
    } catch (e) {
        console.error(`[CalendarService] createEventAsync FAILED for calendar ${calendarId}:`, e);
        throw e;
    }
};

export const deleteCalendarEvent = async (eventId: string, options?: { instanceStartDate?: string | Date, futureEvents?: boolean }) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    try {
        const deleteOptions: any = {};
        if (options) {
            if (options.instanceStartDate) {
                const date = new Date(options.instanceStartDate);
                deleteOptions.instanceStartDate = Platform.OS === 'android' ? date.getTime() : date.toISOString();
            }
            if (options.futureEvents !== undefined) {
                deleteOptions.futureEvents = options.futureEvents;
            }
        }

        await Calendar.deleteEventAsync(eventId, deleteOptions);
    } catch (e) {
        console.error(`[CalendarService] deleteEventAsync FAILED for event ${eventId}:`, e);
        throw e;
    }
};

export const updateCalendarEvent = async (eventId: string, eventData: Partial<Calendar.Event> & { editScope?: 'this' | 'future' | 'all', isWork?: boolean, instanceStartDate?: string | Date }) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    // Cast to any to access extra fields
    const data = eventData as any;
    const { workAccountId } = useSettingsStore.getState();

    // Auto-invite work account logic (similar to create)
    if (data.isWork && workAccountId) {
        // We can't easily check existing attendees without fetching, so we skip duplication check for now
        // or rely on native calendar to dedupe.
        // Note: updating attendees usually requires passing the full list.
        // Since we don't have the full list here, this might overwrite or fail if strict.
        // For safety, we only append if 'attendees' is already in data (rare in this flow) or skip.
        // Ideally we would fetch -> merge -> update.
        // For now, we will SKIP modifying attendees during simple update to avoid data loss.
        // TODO: Implement full attendee sync for updates.
    }

    // Prepare data for native call
    const isAndroid = Platform.OS === 'android';
    const nativeEventData: any = {
        title: eventData.title,
        notes: (eventData as any).description || (eventData as any).notes,
        allDay: eventData.allDay,
        location: eventData.location,
        alarms: eventData.alarms,
    };

    if (eventData.startDate) {
        const sDate = new Date(eventData.startDate);
        if (!isNaN(sDate.getTime())) {
            nativeEventData.startDate = isAndroid ? sDate.getTime() : sDate.toISOString();
        }
    }
    if (eventData.endDate) {
        const eDate = new Date(eventData.endDate);
        if (!isNaN(eDate.getTime())) {
            nativeEventData.endDate = isAndroid ? eDate.getTime() : eDate.toISOString();
        }
    }

    // Handle recurrence
    if (data.recurrenceRule === null) {
        nativeEventData.recurrenceRule = null;
    } else if (data.recurrenceRule) {
        const rule = { ...data.recurrenceRule };
        nativeEventData.recurrenceRule = rule;
    } else if (data.recurrence) {
        // ... (Parsing logic similar to create)
        if (Array.isArray(data.recurrence)) {
            const rule = parseRRule(data.recurrence[0]);
            if (rule) nativeEventData.recurrenceRule = rule;
        } else if (typeof data.recurrence === 'string') {
            const rule = parseRRule(data.recurrence);
            if (rule) nativeEventData.recurrenceRule = rule;
        }
    }

    try {
        const options: any = {};
        if (eventData.editScope) {
            if (eventData.editScope === 'this') {
                delete nativeEventData.recurrenceRule;
                if (eventData.instanceStartDate) {
                    const instDate = new Date(eventData.instanceStartDate);
                    options.instanceStartDate = isAndroid ? instDate.getTime() : instDate.toISOString();
                }
                options.futureEvents = false;
            } else if (eventData.editScope === 'future') {
                options.futureEvents = true;
                if (eventData.instanceStartDate) {
                    const instDate = new Date(eventData.instanceStartDate);
                    options.instanceStartDate = isAndroid ? instDate.getTime() : instDate.toISOString();
                }
            } else if (eventData.editScope === 'all') {
                // For 'all', we pass NO options (default), updating the master/series.
                if (Platform.OS === 'ios') {
                    // Best effort for 'all' on iOS if we only have instance context: FutureEvents logic shouldn't apply here?
                    // Usually 'all' updates the base event.
                    // No need to set options.futureEvents = true unless we confirm behavior.
                    // Leaving options blank implies standard update.
                }
            }
        }

        const finalOptions = Object.keys(options).length > 0 ? options : undefined;

        console.log('[CalendarService] Updating event robustly:', eventId, { nativeEventData, finalOptions });
        await Calendar.updateEventAsync(eventId, nativeEventData, finalOptions);
        console.log('[CalendarService] NATIVE updateEventAsync RETURNED successfully');
    } catch (e) {
        console.error(`[CalendarService] updateCalendarEvent FAILED for event ${eventId}:`, e);
        throw e;
    }
}

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
