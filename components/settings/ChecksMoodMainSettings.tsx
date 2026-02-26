import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { HabitSettings } from './HabitSettings';
import { MoodSettings } from './MoodSettings';
import { Colors } from '../ui/design-tokens';
import { BaseScreen } from '../screens/BaseScreen';

export function ChecksMoodMainSettings({ onBack }: { onBack?: () => void }) {
    const [activeTab, setActiveTab] = useState<'habits' | 'mood'>('habits');

    const tabs = [
        { key: 'habits', label: 'Checks' },
        { key: 'mood', label: 'Mood' },
    ];

    return (
        <BaseScreen
            title="Checks & Mood"
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as 'habits' | 'mood')}
            showBackButton={!!onBack}
            onBack={onBack}
        >
            {activeTab === 'habits' ? (
                <HabitSettings isEmbedded={true} />
            ) : (
                <MoodSettings isEmbedded={true} />
            )}
        </BaseScreen>
    );
}
