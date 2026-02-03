import dayjs from 'dayjs';
import { useMoodStore } from '../store/moodStore';
import { useHabitStore } from '../store/habitStore';
import { useSettingsStore } from '../store/settings';
import { getCalendarEvents } from './calendarService';
import * as Calendar from 'expo-calendar';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { useEventTypesStore } from '../store/eventTypes';
import { calculateEventDifficulty } from '../utils/difficultyUtils';

const FORECAST_PROMPT = `
You are a highly perceptive and motivating AI productivity expert. 
Based on the user's recent mood/habits data and their schedule (past 2 weeks, today, and upcoming days), provide a 1-2 sentence day forecast for TODAY.
Will it be a good day or a bad day? Why? What should the user expect?
If the schedule is overloaded, suggest specific events to move or skip (look for [Movable] or [Skippable] flags).
Keep it concise, actionable, and personalized.

## Recent Context (Last 14 Days - Mood & Habits)
{{context}}

## Schedule Overview (Past 2 Weeks + Today + Rest of Week)
{{schedule}}

Forecast for TODAY (1-2 sentences):
`;

export async function generateDayForecast(date: Date): Promise<string> {
    const { apiKey, selectedModel, visibleCalendarIds } = useSettingsStore.getState();
    if (!apiKey) throw new Error("API Key is missing. Please set it in Settings.");

    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = selectedModel || "gemini-2.0-flash-exp";
    const genModel = genAI.getGenerativeModel({ model: modelName });

    // 1. Gather Recent context (Moods & Habits)
    let contextText = "";
    const moodStore = useMoodStore.getState();
    const habitStore = useHabitStore.getState();

    for (let i = 1; i <= 14; i++) {
        const d = dayjs(date).subtract(i, 'day').format('YYYY-MM-DD');
        const mood = moodStore.moods[d];
        const habits = habitStore.records[d] || {};

        if (mood || Object.keys(habits).length > 0) {
            contextText += `Day -${i}: Mood ${mood?.mood || 'N/A'}/5. Habits: ${Object.entries(habits)
                .filter(([_, completed]) => completed)
                .map(([id]) => habitStore.habits.find(h => h.id === id)?.title || id)
                .join(', ') || 'None'
                }\n`;
        }
    }

    if (!contextText) contextText = "No data for the last 14 days.";

    // 2. Gather Schedule Data
    // Fallback to all calendars if none selected
    let calsToFetch = visibleCalendarIds;
    if (calsToFetch.length === 0) {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        calsToFetch = calendars.map(c => c.id);
    }

    const { eventFlags, difficulties, ranges, assignments, eventTypes } = useEventTypesStore.getState();

    // Helper function to format events for a given day
    const formatEventsForDay = async (dayDate: dayjs.Dayjs, label: string): Promise<string> => {
        const start = dayDate.startOf('day').toDate();
        const end = dayDate.endOf('day').toDate();
        const dayEvents = await getCalendarEvents(calsToFetch, start, end);

        if (dayEvents.length === 0) return `### ${label}\nNo events.`;

        const formatted = dayEvents.map(e => {
            const time = dayjs(e.startDate).format('HH:mm');
            const flags = eventFlags?.[e.title];
            const baseDifficulty = difficulties?.[e.title] ?? 1;
            const diffResult = calculateEventDifficulty(
                { title: e.title, start: new Date(e.startDate), end: new Date(e.endDate) },
                baseDifficulty,
                ranges,
                flags
            );

            const typeId = assignments?.[e.title];
            const eventType = typeId ? eventTypes.find(t => t.id === typeId) : null;

            let meta: string[] = [];
            if (eventType) meta.push(`Type: ${eventType.title}`);
            if (diffResult.total > 0) meta.push(`Difficulty: ${diffResult.total}`);
            if (flags?.isEnglish) meta.push('English');
            if (flags?.movable) meta.push('Movable');
            if (flags?.skippable) meta.push('Skippable');
            if (flags?.needPrep) meta.push('Prep Needed');

            return `- ${e.title} (${time})${meta.length > 0 ? ' [' + meta.join(', ') + ']' : ''}`;
        }).join('\n');

        return `### ${label}\n${formatted}`;
    };

    let scheduleText = "";

    // 2a. Past 14 days schedule (context)
    for (let i = 14; i >= 1; i--) {
        const pastDay = dayjs(date).subtract(i, 'day');
        const dayLabel = `Day -${i} (${pastDay.format('ddd, MMM D')})`;
        scheduleText += await formatEventsForDay(pastDay, dayLabel) + '\n\n';
    }

    // 2b. Today
    scheduleText += await formatEventsForDay(dayjs(date), `TODAY (${dayjs(date).format('ddd, MMM D')})`) + '\n\n';

    // 2c. Upcoming days until end of week (Sunday)
    const endOfWeek = dayjs(date).endOf('week'); // Sunday
    let nextDay = dayjs(date).add(1, 'day');
    while (nextDay.isBefore(endOfWeek) || nextDay.isSame(endOfWeek, 'day')) {
        const daysAhead = nextDay.diff(dayjs(date), 'day');
        const dayLabel = `Day +${daysAhead} (${nextDay.format('ddd, MMM D')})`;
        scheduleText += await formatEventsForDay(nextDay, dayLabel) + '\n\n';
        nextDay = nextDay.add(1, 'day');
    }


    // 3. Build Prompt & Call Gemini
    const finalPrompt = FORECAST_PROMPT
        .replace('{{context}}', contextText)
        .replace('{{schedule}}', scheduleText);

    try {
        const result = await genModel.generateContent(finalPrompt);
        const response = result.response;
        return response.text().trim();
    } catch (e: any) {
        console.error("[ForecastService] AI generation failed:", e);
        throw new Error("Failed to generate forecast. Please check your API key.");
    }
}
