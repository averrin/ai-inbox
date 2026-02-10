import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export interface StatusConfig {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    label: string;
}

export const getStatusConfig = (status: string): StatusConfig => {
    switch (status) {
        case 'x':
            return { icon: 'checkbox', color: '#6366f1', label: 'Completed' };
        case '/':
            return { icon: 'play-circle-outline', color: '#818cf8', label: 'In Progress' };
        case '-':
            return { icon: 'close-circle-outline', color: '#94a3b8', label: 'Abandoned' };
        case '?':
            return { icon: 'help-circle-outline', color: '#fbbf24', label: 'Planned' };
        case '>':
            return { icon: 'arrow-forward-circle-outline', color: '#6366f1', label: 'Delayed' };
        default:
            return { icon: 'square-outline', color: '#94a3b8', label: 'Pending' };
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
