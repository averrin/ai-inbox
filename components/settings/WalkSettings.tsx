import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../store/settings';
import { useWalkStore } from '../../store/walkStore';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const DEFAULT_WALK_PROMPT = `
You are an expert scheduler and wellness coach.
Your goal is to find the BEST 1-HOURLY slot for a "Walk" event between 10:00 and 19:00.

Consider:
1.  **Weather**: Avoid rain/extreme heat. Prefer sunny/mild times.
2.  **Schedule**: Avoid conflicts. Look for gaps. If busy, find a "Movable" or "Skippable" block to replace/move.
3.  **Productivity**: A walk is good for a break. Mid-day or late afternoon is often best.

Return valid JSON with:
{
  "start": "ISO_DATE_STRING",
  "reason": "Short explanation of why this time was chosen (e.g., 'Sunny break between meetings')."
}
If no suitable time is found, return null.
`;

export function WalkSettings() {
    const { walkPrompt, setWalkPrompt, walkLookaheadDays, setWalkLookaheadDays } = useSettingsStore();
    const { clearSuggestions } = useWalkStore();
    const [prompt, setPrompt] = useState(walkPrompt || DEFAULT_WALK_PROMPT);
    const [lookahead, setLookahead] = useState(walkLookaheadDays.toString());
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setPrompt(walkPrompt || DEFAULT_WALK_PROMPT);
        setLookahead(walkLookaheadDays.toString());
    }, [walkPrompt, walkLookaheadDays]);

    const handleSave = () => {
        const days = parseInt(lookahead);
        if (isNaN(days) || days < 1 || days > 7) {
            Alert.alert("Invalid Input", "Lookahead days must be between 1 and 7.");
            return;
        }

        setWalkPrompt(prompt);
        setWalkLookaheadDays(days);
        setIsDirty(false);
        Toast.show({
            type: 'success',
            text1: 'Walk Settings Saved',
        });
    };

    const handleReset = () => {
        Alert.alert(
            "Reset Settings",
            "Are you sure you want to reset to defaults?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: () => {
                        setWalkPrompt(null);
                        setWalkLookaheadDays(3);
                        setPrompt(DEFAULT_WALK_PROMPT);
                        setLookahead('3');
                        setIsDirty(false);
                        Toast.show({
                            type: 'success',
                            text1: 'Settings Reset to Default',
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
                    <Text className="text-indigo-200 mb-2 font-semibold">Walk Suggestion Settings</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Customize how the AI suggests walk times.
                    </Text>

                    <View className="mb-4">
                        <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">Lookahead Days</Text>
                        <TextInput
                            className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-white"
                            value={lookahead}
                            onChangeText={(text) => {
                                setLookahead(text);
                                setIsDirty(true);
                            }}
                            keyboardType="numeric"
                            placeholder="3"
                            placeholderTextColor="#64748b"
                        />
                        <Text className="text-slate-500 text-xs mt-1 ml-1">
                            How many days in advance to generate suggestons (1-7).
                        </Text>
                    </View>

                    <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">Custom Prompt</Text>
                    <View className="bg-slate-800 border border-slate-700 rounded-xl p-0 overflow-hidden mb-4">
                        <TextInput
                            className="text-white p-4 text-sm font-mono leading-5 min-h-[200px]"
                            value={prompt}
                            onChangeText={(text) => {
                                setPrompt(text);
                                setIsDirty(true);
                            }}
                            multiline
                            textAlignVertical="top"
                            placeholder="Enter your custom prompt..."
                            placeholderTextColor="#64748b"
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
                            className="bg-red-500/10 border border-red-500/20 px-4 rounded-xl items-center justify-center"
                        >
                            <Ionicons name="refresh-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Card>

            <Card className="mt-4">
                <View className="mb-2">
                    <Text className="text-indigo-200 mb-2 font-semibold">Data Management</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Clear cached suggestions if they are outdated or incorrect.
                    </Text>

                    <Button
                        title="Clear Cached Suggestions"
                        variant="secondary"
                        onPress={() => {
                            clearSuggestions();
                            Toast.show({
                                type: 'success',
                                text1: 'Suggestions Cleared',
                                text2: 'New suggestions will be generated shortly.'
                            });
                        }}
                    />
                </View>
            </Card>
        </ScrollView>
    );
}
