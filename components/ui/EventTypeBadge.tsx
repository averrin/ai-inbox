import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UniversalIcon } from './UniversalIcon';
import { EventType } from '../../services/eventTypeService';

interface EventTypeBadgeProps {
    type: EventType;
}

export function EventTypeBadge({ type }: EventTypeBadgeProps) {
    const isInv = type.isInverted;
    const pillStyle = isInv
        ? { backgroundColor: 'transparent', borderWidth: 1, borderColor: type.color }
        : { backgroundColor: type.color };
    const textColor = isInv ? type.color : 'white';

    return (
        <View
            style={[pillStyle, { alignSelf: 'flex-start' }]}
            className="flex-row items-center px-3 py-1.5 rounded-md gap-2"
        >
            {type.icon && (
                <UniversalIcon name={type.icon} size={16} color={textColor} />
            )}
            <Text style={{ color: textColor }} className="font-semibold text-base">
                {type.title}
            </Text>
        </View>
    );
}
