import React from 'react'
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native'
import { ColorPickerModal } from './color-picker/ColorPickerModal'
import { Colors, Palette } from './design-tokens'

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
    colors = Palette,
    columns = 8,
    style,
}: ColorPickerProps) => {
    const [showCustomPicker, setShowCustomPicker] = React.useState(false);

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

                <TouchableOpacity
                    onPress={() => setShowCustomPicker(true)}
                    className={`w-8 h-8 rounded-full border-2 ${!colors.includes(value) ? 'border-white' : 'border-slate-600'} items-center justify-center`}
                    style={{ backgroundColor: !colors.includes(value) ? value : Colors.surface }}
                    accessibilityLabel="Custom color"
                    accessibilityRole="button"
                >
                    {!colors.includes(value) ? null : (
                        <View className="w-4 h-4 rounded-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500" style={{ opacity: 0.8 }}>
                            <Text style={{ fontSize: 10, color: 'white', textAlign: 'center', lineHeight: 16 }}>+</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ColorPickerModal
                visible={showCustomPicker}
                initialColor={value}
                onClose={() => setShowCustomPicker(false)}
                onSelect={(color) => {
                    onChange(color);
                    setShowCustomPicker(false);
                }}
            />
        </View>
    )
}
