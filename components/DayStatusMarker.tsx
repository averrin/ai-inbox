import React from 'react';
import { View } from 'react-native';
import { DayStatusLevel } from '../utils/difficultyUtils';
import { Colors } from './ui/design-tokens';

interface Props {
    status: DayStatusLevel;
    size?: number;
}

export function DayStatusMarker({ status, size = 12 }: Props) {
    const getColor = (s: DayStatusLevel) => {
        switch (s) {
            case 'healthy': return Colors.status.healthy;
            case 'moderate': return Colors.status.moderate;
            case 'busy': return Colors.status.busy;
            case 'overloaded': return Colors.status.overloaded;
            default: return Colors.status.healthy;
        }
    };

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: getColor(status),
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.2)'
            }}
        />
    );
}
