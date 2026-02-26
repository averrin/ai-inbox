import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { HabitSettings } from './HabitSettings';
import { MoodSettings } from './MoodSettings';
import { Colors } from '../ui/design-tokens';

export function ChecksMoodMainSettings({ onBack }: { onBack?: () => void }) {
    const [activeTab, setActiveTab] = useState<'habits' | 'mood'>('habits');

    return (
        <View className="px-4 mt-2">
            <View className="flex-row mb-4 bg-surface rounded-lg p-1">
                <TouchableOpacity
                    onPress={() => setActiveTab('habits')}
                    className={`flex-1 py-2 rounded-md items-center ${activeTab === 'habits' ? 'bg-primary' : 'bg-transparent'}`}
                >
                    <Text className={`${activeTab === 'habits' ? 'text-white' : 'text-text-tertiary'} font-medium`}>Checks</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('mood')}
                    className={`flex-1 py-2 rounded-md items-center ${activeTab === 'mood' ? 'bg-primary' : 'bg-transparent'}`}
                >
                    <Text className={`${activeTab === 'mood' ? 'text-white' : 'text-text-tertiary'} font-medium`}>Mood</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'habits' ? (
                <HabitSettings isEmbedded={true} />
            ) : (
                <MoodSettings isEmbedded={true} />
            )}
        </View>
    );
}
