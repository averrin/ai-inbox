import React from 'react';
import { ScrollView } from 'react-native';
import { Card } from '../ui/Card';
import { DefaultedPrompt } from '../ui/DefaultedPrompt';
import { useSettingsStore } from '../../store/settings';

const DEFAULT_PROMPT = `
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

export function ForecastSettings() {
    const { forecastPrompt, setForecastPrompt } = useSettingsStore();

    return (
        <ScrollView>
            <Card>
                <DefaultedPrompt
                    title="AI Forecast Prompt"
                    description="Customize how the AI generates your daily forecast."
                    currentValue={forecastPrompt}
                    defaultValue={DEFAULT_PROMPT}
                    onSave={setForecastPrompt}
                    placeholders={['{{context}}', '{{schedule}}']}
                />
            </Card>
        </ScrollView>
    );
}
