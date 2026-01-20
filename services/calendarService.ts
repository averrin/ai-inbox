import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export class CalendarService {
    static async requestPermissions(): Promise<boolean> {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        return status === 'granted';
    }

    static async getUpcomingEvents(days: number = 7): Promise<string> {
        const { status } = await Calendar.getCalendarPermissionsAsync();
        if (status !== 'granted') {
            return "Calendar access denied.";
        }

        try {
            const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            // Simpler strategy: verify we have calendars
            if (calendars.length === 0) return "No calendars found.";

            // Filter for default/primary calendars is tricky across OS.
            // On iOS, source.type === 'caldav' is common for iCloud/Google.
            // On Android, isPrimary is often unreliable or requires specific access.
            // For now, let's fetch from all calendars that are modifiable or visible (by default getEventsAsync queries selected calendars if IDs not provided? No, IDs required.)

            // Let's select "writable" or "primary"-ish calendars
            const calendarIds = calendars
                .filter(c => c.isPrimary || c.source.name === 'iCloud' || c.source.name === 'Gmail')
                .map(c => c.id);

            // Fallback: use all if filtering is too aggressive
            const targetIds = calendarIds.length > 0 ? calendarIds : calendars.map(c => c.id);

            if (targetIds.length === 0) return "No suitable calendars found.";

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + days);

            const events = await Calendar.getEventsAsync(targetIds, startDate, endDate);

            if (events.length === 0) {
                return "No upcoming events.";
            }

            // Sort and format
            const formatted = events
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map(e => {
                    const start = new Date(e.startDate).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    return `- [${start}] ${e.title}`;
                })
                .join('\n');

            return formatted;
        } catch (error) {
            console.error("Failed to fetch calendar events:", error);
            return "Error fetching calendar events.";
        }
    }
}
