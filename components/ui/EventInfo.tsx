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
}

export function EventInfo({ action, onRemove, showRemove = true }: EventInfoProps) {
    const leftIcon = (
        <Text className="text-green-400 text-lg text-center">⦿</Text>
    );

    const formattedTime = action.startTime 
        ? new Date(action.startTime).toLocaleString([], {
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
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
                <Text className="text-indigo-300 text-xs">
                    {formattedTime} {durationText} {recurrenceText}
                </Text>
             )}
             {action.description && (
                <Text className="text-slate-400 text-xs mt-1" numberOfLines={2}>
                    {action.description}
                </Text>
             )}
        </View>
    );

    const actions = showRemove && onRemove ? (
        <ActionButton onPress={onRemove} icon="trash-outline" variant="danger" />
    ) : null;

    return (
        <BaseListItem
            leftIcon={leftIcon}
            title={action.title}
            subtitle={subtitle}
            rightActions={actions}
            // BaseListItem styling override for the icon container to look like original? 
            // Original didn't have a background for the dot, it was just text.
            // BaseListItem wraps icon in: w-10 h-10 bg-slate-700 rounded-lg overflow-hidden
            // It might look a bit different. Let's try standard BaseListItem look.
        />
    );
}
