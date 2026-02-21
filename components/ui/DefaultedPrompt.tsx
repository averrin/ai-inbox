import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Button } from './Button';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import Toast from 'react-native-toast-message';

interface DefaultedPromptProps {
    title: string;
    description?: string;
    currentValue: string | null;
    defaultValue: string;
    onSave: (value: string | null) => void;
    placeholders?: string[];
    testID?: string;
}

export function DefaultedPrompt({
    title,
    description,
    currentValue,
    defaultValue,
    onSave,
    placeholders = [],
    testID
}: DefaultedPromptProps) {
    const [prompt, setPrompt] = useState(currentValue || defaultValue);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setPrompt(currentValue || defaultValue);
        setIsDirty(false);
    }, [currentValue, defaultValue]);

    const handleTextChange = (text: string) => {
        setPrompt(text);
        // Mark as dirty if it differs from the persisted value (which is currentValue or defaultValue)
        // If currentValue is null (using default), we compare against defaultValue
        const effectiveCurrent = currentValue || defaultValue;
        setIsDirty(text !== effectiveCurrent);
    };

    const handleSave = () => {
        // If matches default, save as null to clear override
        const valueToSave = prompt.trim() === defaultValue.trim() ? null : prompt;
        onSave(valueToSave);
        // Optimistically set dirty to false, though useEffect will update it
        setIsDirty(false);
        Toast.show({
            type: 'success',
            text1: 'Prompt Saved',
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
                        onSave(null);
                        setPrompt(defaultValue);
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
        <View testID={testID}>
            <Text className="text-text-secondary mb-2 font-semibold">{title}</Text>
            {description && (
                <Text className="text-text-tertiary text-sm mb-4">
                    {description}
                </Text>
            )}

            {placeholders.length > 0 && (
                <View className="bg-surface border border-border rounded-xl p-3 mb-4">
                    <Text className="text-secondary text-xs mb-2 uppercase font-bold tracking-wider">Available Placeholders</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {placeholders.map(p => (
                            <View key={p} className="bg-surface-highlight px-2 py-1 rounded border border-primary">
                                <Text className="text-text-secondary text-xs font-mono">{p}</Text>
                            </View>
                        ))}
                    </View>
                    <Text className="text-secondary text-xs mt-2 italic">
                        These will be replaced with your actual data before sending to the AI.
                    </Text>
                </View>
            )}

            <View className="bg-surface border border-border rounded-xl p-0 overflow-hidden mb-4">
                <TextInput
                    className="text-white p-4 text-sm font-mono leading-5 min-h-[200px]"
                    value={prompt}
                    onChangeText={handleTextChange}
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
    );
}
