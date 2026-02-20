import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Colors } from '../ui/design-tokens';

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
    const [prompt, setPrompt] = useState(forecastPrompt || DEFAULT_PROMPT);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setPrompt(forecastPrompt || DEFAULT_PROMPT);
    }, [forecastPrompt]);

    const handleSave = () => {
        setForecastPrompt(prompt);
        setIsDirty(false);
        Toast.show({
            type: 'success',
            text1: 'Forecast Prompt Saved',
        });
    };

    const handleReset = () => {
        Alert.alert(
            "Reset Prompt",
            "Are you sure you want to reset the prompt to the default?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: () => {
                        setForecastPrompt(null);
                        setPrompt(DEFAULT_PROMPT);
                        setIsDirty(false);
                        Toast.show({
                            type: 'success',
                            text1: 'Prompt Reset to Default',
                        });
                    }
                }
            ]
        );
    };

    return (
        <ScrollView>
            <Card>
                <View className="mb-4">
                    <Text className="text-text-secondary mb-2 font-semibold">AI Forecast Prompt</Text>
                    <Text className="text-text-tertiary text-sm mb-4">
                        Customize how the AI generates your daily forecast.
                    </Text>

                    <View className="bg-surface border border-border rounded-xl p-3 mb-4">
                        <Text className="text-secondary text-xs mb-2 uppercase font-bold tracking-wider">Available Placeholders</Text>
                        <View className="flex-row flex-wrap gap-2">
                            <View className="bg-surface-highlight px-2 py-1 rounded border border-primary">
                                <Text className="text-text-secondary text-xs font-mono">{`{{context}}`}</Text>
                            </View>
                            <View className="bg-surface-highlight px-2 py-1 rounded border border-primary">
                                <Text className="text-text-secondary text-xs font-mono">{`{{schedule}}`}</Text>
                            </View>
                        </View>
                        <Text className="text-secondary text-xs mt-2 italic">
                            These will be replaced with your actual data before sending to the AI.
                        </Text>
                    </View>

                    <View className="bg-surface border border-border rounded-xl p-0 overflow-hidden mb-4">
                        <TextInput
                            className="text-white p-4 text-sm font-mono leading-5 min-h-[200px]"
                            value={prompt}
                            onChangeText={(text) => {
                                setPrompt(text);
                                setIsDirty(text !== (forecastPrompt || DEFAULT_PROMPT));
                            }}
                            multiline
                            textAlignVertical="top"
                            placeholder="Enter your custom prompt..."
                            placeholderTextColor={Colors.secondary}
                        />
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1">
                            <Button
                                title="Save Changes"
                                onPress={handleSave}
                                disabled={!isDirty}
                                variant={isDirty ? "primary" : "secondary"}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleReset}
                            className="bg-error/10 border border-error/20 px-4 rounded-xl items-center justify-center"
                        >
                            <Ionicons name="refresh-outline" size={20} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Card>
        </ScrollView>
    );
}
