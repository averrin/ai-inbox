import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../../services/reminderService';

interface ReminderItemProps {
    reminder: Reminder;
    relativeTime?: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onShow?: () => void;
    timeFormat: '12h' | '24h';
    showActions?: boolean;
}

export function ReminderItem({ reminder, relativeTime, onEdit, onDelete, onShow, timeFormat, showActions = true }: ReminderItemProps) {
    // If relativeTime is not provided, calculate it internaly? 
    // For now, let's keep it optional or copy the logic if needed. 
    // The original component accepted it as a prop.

    return (
        <View className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center">
            <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-1 gap-2">
                    <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color="#fbbf24" />
                        <Text className="text-yellow-400 text-xs font-bold ml-1">
                            {new Date(reminder.reminderTime).toLocaleString(undefined, {
                                hour12: timeFormat === '12h', 
                                hour: '2-digit', 
                                minute: '2-digit',
                                day: 'numeric',
                                month: 'short'
                            })}
                        </Text>
                        {reminder.recurrenceRule && (
                             <View className="ml-2 flex-row items-center bg-indigo-900/50 px-1.5 py-0.5 rounded">
                                <Ionicons name="repeat" size={10} color="#818cf8" />
                                <Text className="text-indigo-300 text-[10px] ml-1">{reminder.recurrenceRule}</Text>
                            </View>
                        )}
                    </View>
                    {relativeTime && (
                        <Text className="text-indigo-300 text-xs font-medium">
                            ({relativeTime})
                        </Text>
                    )}
                </View>
                <Text className="text-white font-bold mb-1">{reminder.fileName}</Text>
                <Text className="text-slate-400 text-sm" numberOfLines={1}>{reminder.content}</Text>
            </View>
            {showActions && (
                <View className="flex-row gap-2">
                    {onShow && (
                        <TouchableOpacity
                            onPress={onShow}
                            className="p-2 bg-emerald-900/50 rounded-lg"
                        >
                            <Ionicons name="play" size={16} color="#4ade80" />
                        </TouchableOpacity>
                    )}
                    {onEdit && (
                        <TouchableOpacity
                            onPress={onEdit}
                            className="p-2 bg-slate-700 rounded-lg"
                        >
                            <Ionicons name="pencil" size={16} color="white" />
                        </TouchableOpacity>
                    )}
                    {onDelete && (
                        <TouchableOpacity
                            onPress={onDelete}
                            className="p-2 bg-red-900/50 rounded-lg"
                        >
                            <Ionicons name="trash" size={16} color="#fca5a5" />
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}
