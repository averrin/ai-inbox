import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Palette } from './design-tokens';

export interface StatusConfig {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
}

export const getStatusConfig = (status: string): StatusConfig => {
    switch (status) {
        case 'x':
            return { icon: 'checkbox', color: Palette[14], label: 'Completed' };
        case '/':
            return { icon: 'play-circle-outline', color: '#818cf8', label: 'In Progress' };
        case '-':
            return { icon: 'close-circle-outline', color: Colors.text.tertiary, label: 'Abandoned' };
        case '?':
            return { icon: 'help-circle-outline', color: '#fbbf24', label: 'Planned' };
        case '>':
            return { icon: 'arrow-forward-circle-outline', color: Palette[14], label: 'Delayed' };
        default:
            return { icon: 'square-outline', color: Colors.text.tertiary, label: 'Pending' };
    }
};

interface TaskStatusIconProps {
    status: string;
    size?: number;
    color?: string;
}

export function TaskStatusIcon({ status, size = 24, color }: TaskStatusIconProps) {
    const config = getStatusConfig(status);
    return (
        <Ionicons 
            name={config.icon} 
            size={size} 
            color={color || config.color} 
        />
    );
}
