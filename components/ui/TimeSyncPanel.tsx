import React from 'react';
import { View, Text, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
        <View className="bg-slate-800/50 rounded-xl p-2 mb-2 border border-slate-700 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 mr-2">
                <Text className="text-indigo-200 text-xs font-semibold">Time Sync</Text>
                <Switch
                    value={isSynced}
                    onValueChange={onToggleSync}
                    trackColor={{ false: '#334155', true: '#4f46e5' }}
                    thumbColor={isSynced ? '#e0e7ff' : '#94a3b8'}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
            </View>

            {!isSynced ? (
                <View className="flex-row gap-2 flex-1 justify-end">
                    <TouchableOpacity 
                        onPress={onCopyReminderToEvents}
                        className="bg-slate-700 px-3 py-1.5 rounded-lg flex-row items-center gap-1 border border-slate-600"
                    >
                        <Ionicons name="arrow-down" size={12} color="#fbbf24" />
                        <Text className="text-slate-200 text-[10px] font-medium">To Events</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={onCopyEventsToReminder}
                        className="bg-slate-700 px-3 py-1.5 rounded-lg flex-row items-center gap-1 border border-slate-600"
                    >
                        <Ionicons name="arrow-up" size={12} color="#4ade80" />
                        <Text className="text-slate-200 text-[10px] font-medium">To Reminder</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                 <Text className="text-slate-400 text-[10px] italic flex-1 text-right">
                    Synced
                </Text>
            )}
        </View>
    );
}
