import React from 'react';
import { View } from 'react-native';
import { DayStatusLevel } from '../utils/difficultyUtils';

interface Props {
    status: DayStatusLevel;
    size?: number;
}

export function DayStatusMarker({ status, size = 12 }: Props) {
    const getColor = (s: DayStatusLevel) => {
        switch (s) {
            case 'healthy': return '#22c55e'; // Green
            case 'moderate': return '#eab308'; // Yellow
            case 'busy': return '#f97316'; // Orange
            case 'overloaded': return '#ef4444'; // Red
            default: return '#22c55e';
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
