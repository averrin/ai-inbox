import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import { AppButton } from './AppButton';

interface TimeSyncPanelProps {
    isSynced: boolean;
    onToggleSync: (value: boolean) => void;
    onCopyReminderToEvents: () => void;
    onCopyEventsToReminder: () => void;
}

export function TimeSyncPanel({
    isSynced,
    onToggleSync,
    onCopyReminderToEvents,
    onCopyEventsToReminder
}: TimeSyncPanelProps) {
    return (
        <View className="bg-surface/50 rounded-xl p-2 mb-2 border border-border flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 mr-2">
                <Text className="text-text-secondary text-xs font-semibold">Time Sync</Text>
                <Switch
                    value={isSynced}
                    onValueChange={onToggleSync}
                    trackColor={{ false: Colors.surfaceHighlight, true: '#4f46e5' }}
                    thumbColor={isSynced ? '#e0e7ff' : Colors.text.tertiary}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
            </View>

            {!isSynced ? (
                <View className="flex-row gap-2 flex-1 justify-end">
                    <AppButton
                        icon="arrow-down"
                        title="To Events"
                        variant="secondary"
                        size="xs"
                        rounding="md"
                        color="#fbbf24"
                        onPress={onCopyReminderToEvents}
                    />
                    <AppButton
                        icon="arrow-up"
                        title="To Reminder"
                        variant="secondary"
                        size="xs"
                        rounding="md"
                        color="#4ade80"
                        onPress={onCopyEventsToReminder}
                    />
                </View>
            ) : (
                 <Text className="text-text-tertiary text-[10px] italic flex-1 text-right">
                    Synced
                </Text>
            )}
        </View>
    );
}
