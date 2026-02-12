import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';

interface UniversalIconProps {
    name: string;
    size?: number;
    color?: string;
    style?: StyleProp<TextStyle>;
}

export function UniversalIcon({ name, size = 24, color = 'white', style }: UniversalIconProps) {
    if (name.startsWith('mc/')) {
        const iconName = name.replace('mc/', '');
        return <MaterialCommunityIcons name={iconName as any} size={size} color={color} style={style} />;
    }

    // Default to Ionicons
    return <Ionicons name={name as any} size={size} color={color} style={style} />;
}
