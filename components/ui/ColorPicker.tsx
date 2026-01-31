import React from 'react';
import { View, TouchableOpacity, ViewProps } from 'react-native';

export const PRESET_COLORS = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#d946ef', // fuchsia-500
    '#64748b', // slate-500
];

interface ColorPickerProps extends ViewProps {
    selectedColor: string;
    onSelectColor: (color: string) => void;
    colors?: string[];
}

export function ColorPicker({ selectedColor, onSelectColor, colors = PRESET_COLORS, className, ...props }: ColorPickerProps) {
    return (
        <View className={`flex-row flex-wrap gap-3 ${className}`} {...props}>
            {colors.map(color => (
                <TouchableOpacity
                    key={color}
                    onPress={() => onSelectColor(color)}
                    className={`w-8 h-8 rounded-full ${selectedColor === color ? 'border-2 border-white' : ''}`}
                    style={{ backgroundColor: color }}
                />
            ))}
        </View>
    );
}
