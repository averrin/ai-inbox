import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from './design-tokens';

interface FloatingActionButtonProps {
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    style?: ViewStyle;
    color?: string;
}

export function FloatingActionButton({ 
    onPress, 
    icon = "add", 
    style,
    color = Palette[14] // indigo-500
}: FloatingActionButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-black/40 z-50 bg-primary"
            style={[{ backgroundColor: color }, style]}
        >
            <Ionicons name={icon} size={30} color="white" />
        </TouchableOpacity>
    );
}
