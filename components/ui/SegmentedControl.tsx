import React from 'react';
import { View, Text, TouchableOpacity, ViewProps } from 'react-native';

export interface SegmentOption<T> {
    label: string;
    value: T;
}

interface SegmentedControlProps<T> extends ViewProps {
    options: SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    activeColor?: string;
    inactiveColor?: string;
}

export function SegmentedControl<T extends string | number>({
    options,
    value,
    onChange,
    activeColor = "bg-indigo-600 border-indigo-500",
    inactiveColor = "bg-slate-800 border-slate-700",
    className,
    ...props
}: SegmentedControlProps<T>) {
    return (
        <View className={`flex-row flex-wrap gap-2 ${className}`} {...props}>
            {options.map((option) => (
                <TouchableOpacity
                    key={String(option.value)}
                    onPress={() => onChange(option.value)}
                    className={`px-4 py-2 rounded-xl border ${value === option.value ? activeColor : inactiveColor}`}
                >
                    <Text className={`font-medium ${value === option.value ? 'text-white' : 'text-slate-400'}`}>
                        {option.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}
