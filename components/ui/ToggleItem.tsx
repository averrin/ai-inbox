import React from 'react';
import { View, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToggleItemProps extends TouchableOpacityProps {
    title: string;
    description?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    value: boolean;
    onToggle: (value: boolean) => void;
    iconColor?: string;
    activeColor?: string;
}

export function ToggleItem({
    title,
    description,
    icon,
    value,
    onToggle,
    iconColor = "#818cf8",
    activeColor = "bg-indigo-600",
    className,
    ...props
}: ToggleItemProps) {
    return (
        <TouchableOpacity
            onPress={() => onToggle(!value)}
            className={`bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between ${className}`}
            {...props}
        >
            <View className="flex-row items-center flex-1">
                {icon && <Ionicons name={icon} size={20} color={iconColor} />}
                <View className={icon ? "ml-3 flex-1" : "flex-1"}>
                    <Text className="text-white font-medium">{title}</Text>
                    {description && <Text className="text-slate-400 text-xs">{description}</Text>}
                </View>
            </View>
            <View className={`w-12 h-7 rounded-full p-1 ${value ? activeColor : 'bg-slate-700'}`}>
                <View className={`w-5 h-5 rounded-full bg-white ${value ? 'ml-auto' : ''}`} />
            </View>
        </TouchableOpacity>
    );
}
