import React from 'react';
import { View, Text } from 'react-native';
import { BaseListItem } from './BaseListItem';
import { ActionButton } from './ActionButton';
import { Action } from '../../services/gemini'; // Assuming Action type is exported from there or needs to be defined

interface EventInfoProps {
    action: {
        title: string;
        description?: string;
        startTime?: string;
        durationMinutes?: number;
        recurrence?: string | string[];
    };
    onRemove?: () => void;
    showRemove?: boolean;
    onEdit?: () => void;
    timeFormat: '12h' | '24h';
}

export function EventInfo({ action, onRemove, showRemove = true, onEdit, timeFormat }: EventInfoProps) {
    const leftIcon = (
        <Text className="text-success text-lg text-center">⦿</Text>
    );

    const formattedTime = action.startTime 
        ? new Date(action.startTime).toLocaleString(undefined, {
            hour12: timeFormat === '12h',
            hour: '2-digit', 
            minute: '2-digit',
            day: 'numeric',
            month: 'short'
          })
        : '';
        
    const hasRecurrence = Array.isArray(action.recurrence) 
        ? action.recurrence.length > 0 
        : !!action.recurrence;
        
    const recurrenceText = hasRecurrence ? '• 🔁 Recurrent' : '';
    const durationText = action.durationMinutes ? ` • ${action.durationMinutes}m` : '';

    const subtitle = (
        <View>
             {action.startTime && (
                <Text className="text-success text-xs font-medium">
                    {formattedTime} <Text className="text-text-secondary font-normal">{durationText} {recurrenceText}</Text>
                </Text>
             )}
             {action.description && (
                <Text className="text-text-tertiary text-xs mt-1" numberOfLines={2}>
                    {action.description}
                </Text>
             )}
        </View>
    );

    const actions = (
        <View className="flex-row gap-1">
             {onEdit && (
                <ActionButton onPress={onEdit} icon="pencil-outline" variant="neutral" />
            )}
            {showRemove && onRemove && (
                <ActionButton onPress={onRemove} icon="trash-outline" variant="danger" />
            )}
        </View>
    );

    return (
        <BaseListItem
            leftIcon={leftIcon}
            title={action.title}
            subtitle={subtitle}
            rightActions={actions}
            // BaseListItem styling override for the icon container to look like original? 
            // Original didn't have a background for the dot, it was just text.
            // BaseListItem wraps icon in: w-10 h-10 bg-surface-highlight rounded-lg overflow-hidden
            // It might look a bit different. Let's try standard BaseListItem look.
        />
    );
}
