import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Reminder } from '../../services/reminderService';
import { BaseListItem } from './BaseListItem';
import { ActionButton } from './ActionButton';

interface ReminderItemProps {
    reminder: Reminder;
    relativeTime?: string;
    onEdit?: () => void;
    onDelete?: () => void;
    onShow?: () => void;
    timeFormat: '12h' | '24h';
    showActions?: boolean;
    title?: string;
}

export function ReminderItem({ reminder, relativeTime, onEdit, onDelete, onShow, timeFormat, showActions = true, title }: ReminderItemProps) {
    
    const formattedTime = new Date(reminder.reminderTime).toLocaleString(undefined, {
        hour12: timeFormat === '12h', 
        hour: '2-digit', 
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
    });

    const leftIcon = (
        <Ionicons name="alarm" size={24} color="#fbbf24" />
    );

    const titleElement = (
        <View className="flex-row items-center gap-2">
            <Text className="text-white font-bold text-sm" numberOfLines={1}>{title || reminder.fileName.replace('.md', '')}</Text>
            {reminder.recurrenceRule && (
                 <View className="flex-row items-center bg-surface-highlight px-1.5 py-0.5 rounded">
                    <Ionicons name="repeat" size={10} color="#818cf8" />
                </View>
            )}
            {reminder.alarm && (
                <View className="flex-row items-center bg-surface-highlight px-1.5 py-0.5 rounded">
                     <Ionicons name="notifications" size={10} color="#f87171" />
                </View>
            )}
            {reminder.persistent && (
                <View className="flex-row items-center bg-surface-highlight px-1.5 py-0.5 rounded">
                    <Ionicons name="alert-circle" size={10} color="#facc15" />
               </View>
           )}
        </View>
    );

    const subtitle = (
        <View>
            <View className="flex-row items-center flex-wrap">
                 <Text className="text-warning text-xs font-medium mr-2">{formattedTime}</Text>
                 {relativeTime && (
                    <Text className="text-text-secondary text-xs">({relativeTime})</Text>
                 )}
            </View>
            {reminder.content ? (
                <Text className="text-text-tertiary text-xs mt-0.5" numberOfLines={1}>{reminder.content}</Text>
            ) : null}
        </View>
    );

    const actions = showActions ? (
        <>
            {onShow && (
                <ActionButton onPress={onShow} icon="eye-outline" variant="neutral" />
            )}
            {onEdit && (
                <ActionButton onPress={onEdit} icon="pencil" variant="neutral" />
            )}
            {onDelete && (
                <ActionButton onPress={onDelete} icon="trash-outline" variant="danger" />
            )}
        </>
    ) : null;

    return (
        <BaseListItem
            leftIcon={leftIcon}
            title={titleElement}
            subtitle={subtitle}
            rightActions={actions}
            onPress={onShow}
        />
    );
}
