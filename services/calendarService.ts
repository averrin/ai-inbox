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

    await Promise.all(calendars.map(async (cal) => {
        try {
            await Calendar.getEventsAsync([cal.id], now, oneWeekLater);
        } catch (e) {
            // Ignore errors for individual calendar checks
        }
    }));

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

export const findNextFreeSlot = async (
    searchDate: Date,
    durationMins: number = 30
): Promise<Date> => {
    // 1. Get readable calendars (using getWritableCalendars which returns all non-AI Inbox)
    const calendars = await getWritableCalendars();
    const calendarIds = calendars.map(c => c.id);

    if (calendarIds.length === 0) {
        return searchDate;
    }

    // 2. Define search window (from searchDate to end of that day)
    const start = new Date(searchDate);
    const end = new Date(searchDate);
    end.setHours(23, 59, 59, 999);

    if (start >= end) {
        return start;
    }

    // 3. Fetch events
    const events = await getCalendarEvents(calendarIds, start, end);

    // 4. Sort by start time
    const sorted = events.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    // 5. Find gap
    let candidateStart = start.getTime();
    const getCandidateEnd = () => candidateStart + durationMins * 60 * 1000;

    for (const event of sorted) {
        const eStart = new Date(event.startDate).getTime();
        const eEnd = new Date(event.endDate).getTime();

        // If candidate fits before next event
        if (getCandidateEnd() <= eStart) {
            return new Date(candidateStart);
        }

        // If candidate overlaps, move start to end of event
        if (candidateStart < eEnd) {
            candidateStart = Math.max(candidateStart, eEnd);
        }
    }

    // Check if fits before end of day
    // If not, we still return the candidate time (which might be late or next day effectively)
    // allowing the user to decide or adjust.
    return new Date(candidateStart);
};

export const deleteCalendarEvent = async (eventId: string, options?: { instanceStartDate?: string | Date, futureEvents?: boolean }) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    try {
        // --- PHANTOM EVENT HANDLING ---
        // Before deleting, unlink any associated tasks to avoid phantoms
        try {
            const { relations } = require('../store/relations').useRelationsStore.getState();
            const { RelationService } = require('./relationService');
            const { vaultUri } = useSettingsStore.getState();

            if (relations[eventId] && relations[eventId].tasks.length > 0 && vaultUri) {
                console.log(`[CalendarService] Unlinking ${relations[eventId].tasks.length} tasks from event ${eventId} before deletion...`);
                await RelationService.unlinkTasksFromEvent(vaultUri, eventId, relations[eventId].tasks);
            }
        } catch (linkErr) {
            console.error('[CalendarService] Failed to unlink tasks during event deletion (non-fatal)', linkErr);
        }
        // -----------------------------

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

export const updateCalendarEvent = async (eventId: string, eventData: Partial<Calendar.Event> & { editScope?: 'this' | 'future' | 'all', isWork?: boolean, instanceStartDate?: string | Date, content?: string }) => {
    const hasPermission = await ensureCalendarPermissions();
    if (!hasPermission) throw new Error("Missing calendar permissions");

    // Cast to any to access extra fields
    const data = eventData as any;
    const { workAccountId } = useSettingsStore.getState();

    // Auto-invite work account logic (similar to create)
    let attendeesToUpdate: Calendar.Attendee[] | undefined;

    if (data.isWork && workAccountId) {
        try {
            let currentAttendees: Calendar.Attendee[] = [];
            if (Platform.OS === 'android') {
                currentAttendees = await Calendar.getAttendeesForEventAsync(eventId);
            } else {
                const evt = await Calendar.getEventAsync(eventId);
                currentAttendees = evt.attendees || [];
            }

            const alreadyAdded = currentAttendees.some(a => a.email?.toLowerCase() === workAccountId.toLowerCase());

            if (!alreadyAdded) {
                const newAttendee: Calendar.Attendee = {
                    email: workAccountId,
                    role: 'attendee',
                    status: 'pending',
                    type: 'person'
                };

                if (Platform.OS === 'android') {
                    // Android: add directly
                    await Calendar.createAttendeeAsync(eventId, newAttendee);
                } else {
                    // iOS: include in update payload
                    attendeesToUpdate = [...currentAttendees, newAttendee];
                }
            }
        } catch (e) {
            console.warn("Failed to auto-invite work account during update", e);
        }
    }

    // Prepare data for native call
    const isAndroid = Platform.OS === 'android';
    const nativeEventData: any = {
        title: eventData.title,
        notes: (eventData as any).content || (eventData as any).description || (eventData as any).notes,
        allDay: eventData.allDay,
        location: eventData.location,
        alarms: eventData.alarms,
    };

    if (eventData.startDate) {
        const sDate = new Date(eventData.startDate);
        if (!isNaN(sDate.getTime())) {
            nativeEventData.startDate = sDate;
        }
    }
    if (eventData.endDate) {
        const eDate = new Date(eventData.endDate);
        if (!isNaN(eDate.getTime())) {
            nativeEventData.endDate = eDate;
            if (isAndroid) {
                // Ensure duration is NOT in the object at all if sending endDate
                delete nativeEventData.duration;
            }
        }
    }

    if (attendeesToUpdate) {
        nativeEventData.attendees = attendeesToUpdate;
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

        // --- ANDROID FIXES START ---
        if (isAndroid) {
            // FIX 1: "Moved whole series"
            // The native patch expects `instanceStartDate` in the event payload (details), NOT in options.
            // If we are editing "this" instance, we must inject it into nativeEventData.
            if (eventData.editScope === 'this' && finalOptions?.instanceStartDate) {
                console.log('[CalendarService] Injecting instanceStartDate into payload for Android exception handling');
                nativeEventData.instanceStartDate = finalOptions.instanceStartDate;

                // FIX 2: "Changed to 15min" / Data Corruption
                // The native patch creates a NEW event (insert) for the exception.
                // If we typically only send { title: 'New Title' }, the new event will have missing dates/duration.
                // We must backfill `startDate` and `duration` (or `endDate`) from the original event if missing.
                if (!nativeEventData.startDate || (!nativeEventData.endDate && !nativeEventData.duration)) {
                    console.log('[CalendarService] Partial update detected for exception. Fetching original event to backfill...');
                    try {
                        const originalEvent = await Calendar.getEventAsync(eventId);
                        if (originalEvent) {
                            // Calculate duration of the master event
                            const masterStart = new Date(originalEvent.startDate).getTime();
                            const masterEnd = new Date(originalEvent.endDate).getTime();
                            const durationMillis = masterEnd - masterStart;

                            // Backfill Start Date
                            if (!nativeEventData.startDate) {
                                // If not changing time, it starts at the instance separation time
                                nativeEventData.startDate = new Date(finalOptions.instanceStartDate as number);
                            }

                            // Backfill End Date (will be converted to duration below)
                            if (!nativeEventData.endDate && !nativeEventData.duration) {
                                const sTime = new Date(nativeEventData.startDate).getTime();
                                nativeEventData.endDate = new Date(sTime + durationMillis);
                            }
                            console.log('[CalendarService] Backfilled data:', {
                                startDate: nativeEventData.startDate,
                                endDate: nativeEventData.endDate
                            });
                        }
                    } catch (fetchErr) {
                        console.warn('[CalendarService] Failed to fetch original event for backfilling:', fetchErr);
                        // Fallback: If we can't fetch, we risk 15min default, but proceed to attempt save.
                    }
                }
            }

            // FIX 3: "Crash on Update" (Cannot have both DTEND and DURATION)
            // Proactively convert endDate to DURATION for Android updates.
            // BUT: skip this for single-instance edits (editScope === 'this') — exception
            // events need DTEND, not DURATION. The native code handles DTEND directly.
            // AND: skip this for normal (non-recurring) events — they use DTEND.
            const isRecurrenceUpdate = eventData.editScope === 'all' || eventData.editScope === 'future' || nativeEventData.recurrenceRule;

            if (nativeEventData.startDate && nativeEventData.endDate && isRecurrenceUpdate) {
                const sTime = new Date(nativeEventData.startDate).getTime();
                const eTime = new Date(nativeEventData.endDate).getTime();
                const durationSeconds = Math.max(0, Math.floor((eTime - sTime) / 1000));

                // Android expects duration in RFC2445 format, e.g., PT1H or PT3600S.
                nativeEventData.duration = `PT${durationSeconds}S`;

                // Strictly exclude DTEND fields when sending DURATION
                delete nativeEventData.endDate;
                delete nativeEventData.endTime; // legacy
                delete nativeEventData.lastDate; // legacy

                console.log('[CalendarService] Converted to DURATION for Android update:', nativeEventData.duration);
            }
        }
        // --- ANDROID FIXES END ---

        try {
            await Calendar.updateEventAsync(eventId, nativeEventData, finalOptions);
        } catch (e: any) {
            // Keep retry logic as a safety net, though the proactive fix should catch most cases
            if (isAndroid && e.message?.includes('both DTEND and DURATION')) {
                console.warn('[CalendarService] STILL detected DTEND/DURATION conflict, retrying...');
                // If we somehow missed the conversion or it failed for another reason related to duration
                // Retrying with same logic is redundant if we already applied it, but harmless.
                // We might want to try forcing duration again or logging more details.

                // Re-apply duration logic if not applied (e.g. if conditions above failed but error occurred)
                const fallbackData = { ...nativeEventData };
                if (!fallbackData.duration && fallbackData.startDate && fallbackData.endDate) {
                    const sTime = new Date(fallbackData.startDate).getTime();
                    const eTime = new Date(fallbackData.endDate).getTime();
                    const durationSeconds = Math.max(0, Math.floor((eTime - sTime) / 1000));
                    (fallbackData as any).duration = `PT${durationSeconds}S`;
                    delete fallbackData.endDate;
                    delete (fallbackData as any).endTime;
                    delete (fallbackData as any).lastDate;

                    console.log('[CalendarService] Retrying update with duration fallback:', (fallbackData as any).duration);
                    await Calendar.updateEventAsync(eventId, fallbackData, finalOptions);
                    console.log('[CalendarService] Retry with duration succeeded');
                    return; // Exit successfully
                }
                throw e;
            } else {
                throw e;
            }
        }
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

    const userAttendee = currentAttendees[userAttendeeIndex];

    console.log(`[CalendarService] Updating RSVP for ${eventId} to ${status}. Attendee:`, { ...userAttendee, status });

    try {
        if (Platform.OS === 'android' && userAttendee.id) {
            // Android: attendees are in a separate table, update directly
            await Calendar.updateAttendeeAsync(userAttendee.id, { status });
        } else {
            const updatedAttendees = [...currentAttendees];
            updatedAttendees[userAttendeeIndex] = { ...userAttendee, status };
            // @ts-ignore - 'attendees' is not in the type definition but is required for RSVP updates
            await Calendar.updateEventAsync(eventId, { attendees: updatedAttendees } as any);
        }
        console.log(`[CalendarService] RSVP update successful for ${eventId}`);
    } catch (e) {
        console.error("Failed to update RSVP:", e);
        throw e;
    }
};
