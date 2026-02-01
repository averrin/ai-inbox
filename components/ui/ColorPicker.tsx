import React from 'react'
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native'

// Extended color palette with modern, harmonious colors
// Organized in color groups for better visual scanning
export const PRESET_COLORS = [
    // Reds & Pinks
    '#ef4444', // red-500
    '#f43f5e', // rose-500
    '#ec4899', // pink-500
    '#d946ef', // fuchsia-500

    // Oranges & Yellows
    '#f97316', // orange-500
    '#f59e0b', // amber-500
    '#eab308', // yellow-500
    '#84cc16', // lime-500

    // Greens
    '#22c55e', // green-500
    '#10b981', // emerald-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500

    // Blues
    '#0ea5e9', // sky-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500

    // Neutrals
    '#a855f7', // purple-500
    '#78716c', // stone-500
    '#64748b', // slate-500
    '#71717a', // zinc-500
]

interface ColorPickerProps {
    value: string
    onChange: (color: string) => void
    label?: string
    colors?: string[]
    columns?: number
    style?: ViewStyle
}

export const ColorPicker = ({
    value,
    onChange,
    label,
    colors = PRESET_COLORS,
    columns = 8,
    style,
}: ColorPickerProps) => {
    return (
        <View style={style}>
            {label && (
                <Text className="text-slate-400 text-xs uppercase font-bold mb-2">
                    {label}
                </Text>
            )}
            <View className="flex-row flex-wrap gap-2">
                {colors.map((color) => (
                    <TouchableOpacity
                        key={color}
                        onPress={() => onChange(color)}
                        className={`w-8 h-8 rounded-full border-2 ${value === color ? 'border-white' : 'border-transparent'
                            }`}
                        style={{ backgroundColor: color }}
                        accessibilityLabel={`Select color ${color}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: value === color }}
                    />
                ))}
            </View>
        </View>
    )
}
