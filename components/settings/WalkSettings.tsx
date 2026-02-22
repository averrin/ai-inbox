import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore } from '../../store/settings';
import { DefaultedPrompt } from '../ui/DefaultedPrompt';
import Toast from 'react-native-toast-message';
import { Colors } from '../ui/design-tokens';
import { showAlert } from '../../utils/alert';

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
    const [lookahead, setLookahead] = useState(walkLookaheadDays.toString());
    const [isLookaheadDirty, setIsLookaheadDirty] = useState(false);

    useEffect(() => {
        setLookahead(walkLookaheadDays.toString());
        setIsLookaheadDirty(false);
    }, [walkLookaheadDays]);

    const handleSaveLookahead = () => {
        const days = parseInt(lookahead);
        if (isNaN(days) || days < 1 || days > 7) {
            showAlert("Invalid Input", "Lookahead days must be between 1 and 7.");
            return;
        }

        setWalkLookaheadDays(days);
        setIsLookaheadDirty(false);
        Toast.show({
            type: 'success',
            text1: 'Lookahead Settings Saved',
        });
    };

    return (
        <ScrollView>
            <Card>
                <View className="mb-4">
                    <Text className="text-text-secondary mb-2 font-semibold">Walk Suggestion Settings</Text>
                    <Text className="text-text-tertiary text-sm mb-4">
                        Customize how the AI suggests walk times.
                    </Text>

                    <View className="mb-6 border-b border-border pb-6">
                        <Text className="text-text-secondary mb-1 ml-1 text-sm font-semibold">Lookahead Days</Text>
                        <TextInput
                            className="bg-surface border border-border rounded-xl p-4 text-white mb-2"
                            value={lookahead}
                            onChangeText={(text) => {
                                setLookahead(text);
                                setIsLookaheadDirty(text !== walkLookaheadDays.toString());
                            }}
                            keyboardType="numeric"
                            placeholder="3"
                            placeholderTextColor={Colors.secondary}
                        />
                        <Text className="text-secondary text-xs mt-1 ml-1 mb-3">
                            How many days in advance to generate suggestons (1-7).
                        </Text>
                        <Button
                            title="Save Lookahead"
                            onPress={handleSaveLookahead}
                            disabled={!isLookaheadDirty}
                            variant={isLookaheadDirty ? "primary" : "secondary"}
                        />
                    </View>

                    <DefaultedPrompt
                        title="Custom Prompt"
                        currentValue={walkPrompt}
                        defaultValue={DEFAULT_WALK_PROMPT}
                        onSave={setWalkPrompt}
                    />
                </View>
            </Card>
        </ScrollView>
    );
}
