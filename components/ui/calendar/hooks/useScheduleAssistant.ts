import { useState, useCallback } from 'react';
import { suggestScheduleRearrangement, ScheduleRearrangementSuggestion, AIRescheduleContext } from '../../../../services/gemini';
import dayjs from 'dayjs';
import { Palette } from '../../design-tokens';
import { updateCalendarEvent } from '../../../../services/calendarService';
import Toast from 'react-native-toast-message';

export interface AssistantSuggestion extends ScheduleRearrangementSuggestion {
    id: string; // Unique ID for the suggestion
    title: string; // Title of the event being moved
}

export function useScheduleAssistant(apiKey: string) {
    const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const generateSuggestions = useCallback(async (events: any[], workRanges: any[]) => {
        if (!apiKey) {
            Toast.show({ type: 'error', text1: 'Missing API Key' });
            return;
        }

        setIsLoading(true);
        try {
            const now = dayjs();

            // Filter and map events for AI context
            // We include ID so the AI can reference it
            const upcomingEvents = events
                .filter(e => dayjs(e.end).isAfter(now) && !e.isVirtual && e.type !== 'marker' && e.type !== 'zone')
                .map(e => ({
                    id: e.originalEvent?.id || e.id,
                    title: e.title,
                    start: e.start,
                    end: e.end,
                    isFixed: !e.movable,
                    difficulty: e.difficulty?.total || 0,
                    attendees: e.originalEvent?.attendees?.length || 0,
                    description: e.originalEvent?.notes || ''
                }));

            const context: AIRescheduleContext = {
                currentTime: now.toISOString(),
                workRanges: workRanges.map(r => ({ start: r.start, end: r.end })),
                upcomingEvents: upcomingEvents as any // Cast to any to include 'id' and 'isFixed' which are not in the strict interface but needed for prompt
            };

            const result = await suggestScheduleRearrangement(apiKey, context);

            // Map to internal structure
            const newSuggestions = result.map((s, index) => {
                // Find original title for better display
                const original = upcomingEvents.find(e => e.id === s.originalEventId);
                return {
                    ...s,
                    id: `suggestion-${Date.now()}-${index}`,
                    title: original ? original.title : 'Unknown Event'
                };
            });

            setSuggestions(newSuggestions);

            if (newSuggestions.length === 0) {
                Toast.show({ type: 'info', text1: 'No suggestions found' });
            } else {
                Toast.show({ type: 'success', text1: `Found ${newSuggestions.length} suggestions` });
            }

        } catch (e) {
            console.error("Assistant Error:", e);
            Toast.show({ type: 'error', text1: 'Failed to generate suggestions' });
        } finally {
            setIsLoading(false);
        }
    }, [apiKey]);

    const acceptSuggestion = useCallback(async (suggestion: AssistantSuggestion) => {
        try {
            await updateCalendarEvent(suggestion.originalEventId, {
                startDate: new Date(suggestion.newStart),
                endDate: new Date(suggestion.newEnd)
            });

            // Remove from list
            setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
            Toast.show({ type: 'success', text1: 'Event moved!' });
            return true;
        } catch (e) {
            console.error("Failed to accept suggestion:", e);
            Toast.show({ type: 'error', text1: 'Failed to move event' });
            return false;
        }
    }, []);

    const dismissSuggestion = useCallback((id: string) => {
        setSuggestions(prev => prev.filter(s => s.id !== id));
    }, []);

    // Convert suggestions to "Ghost Events" for the calendar
    const assistantEvents = suggestions.map(s => ({
        id: s.id,
        title: `Suggested: ${s.title}`,
        start: new Date(s.newStart),
        end: new Date(s.newEnd),
        color: Palette[9], // Distinct color (Emerald)
        type: 'suggestion', // Match ScheduleEvent logic (it uses isSuggestion check on typeTag)
        typeTag: 'ASSISTANT_SUGGESTION',
        originalSuggestion: s,
        movable: false, // Don't let user drag the suggestion itself
        isVirtual: true,
        // Add difficulty/icon to make it look like a real event
        icon: 'sparkles'
    }));

    return {
        suggestions,
        assistantEvents,
        isLoading,
        generateSuggestions,
        acceptSuggestion,
        dismissSuggestion
    };
}
