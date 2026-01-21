export interface CreateEventParams {
    title: string;
    description?: string;
    startTime: string; // RFC3339
    durationMinutes?: number;
    recurrence?: string[];
}

export class GoogleCalendarService {
    private static BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    static async createEvent(accessToken: string, event: CreateEventParams): Promise<any> {
        try {
            const start = new Date(event.startTime);
            const duration = event.durationMinutes || 30;
            const end = new Date(start.getTime() + duration * 60000);

            const payload: any = {
                summary: event.title,
                description: event.description,
                start: {
                    dateTime: start.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use device timezone
                },
                end: {
                    dateTime: end.toISOString(),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                colorId: '11', // '11' is usually Tomato/Red, making it distinctive
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 10 },
                    ],
                },
            };

            if (event.recurrence && event.recurrence.length > 0) {
                payload.recurrence = event.recurrence;
            }

            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google Calendar API Error: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating Google Calendar Event:', error);
            throw error;
        }
    }
}
