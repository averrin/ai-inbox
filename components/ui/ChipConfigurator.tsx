import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MetadataConfig } from '../../store/settings';
import { Colors, Palette } from './design-tokens';
import { ColorPicker } from './ColorPicker';
import { NavIconPicker } from './NavIconPicker';
import { MetadataChip } from './MetadataChip';

interface ChipConfiguratorProps {
    config: MetadataConfig;
    onChange: (config: MetadataConfig) => void;
    showReset?: boolean;
    onReset?: () => void;
    label?: string;
}

export function ChipConfigurator({ config, onChange, showReset, onReset, label }: ChipConfiguratorProps) {
    const [isIconPickerVisible, setIsIconPickerVisible] = useState(false);

    return (
        <View className="gap-6">
            {/* Preview Section */}
            <View className="bg-surface p-4 rounded-xl border border-border items-center">
                <Text className="text-text-tertiary text-xs uppercase font-bold mb-4 w-full">Preview</Text>
                <MetadataChip
                    label={label || 'Example'}
                    color={config.color}
                    variant={config.variant || 'default'}
                    rounding={config.rounding || 'sm'}
                    icon={config.icon}
                    size="md"
                />
            </View>

            {/* Icon Selector */}
            <View>
                <Text className="text-white font-medium text-base mb-2">Icon</Text>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={() => setIsIconPickerVisible(true)}
                        className="h-12 w-12 rounded-xl bg-surface-highlight border border-border items-center justify-center"
                    >
                        {config.icon ? (
                            <Ionicons name={config.icon as any} size={24} color={Colors.text.primary} />
                        ) : (
                            <Ionicons name="add" size={24} color={Colors.text.tertiary} />
                        )}
                    </TouchableOpacity>
                    {config.icon && (
                        <TouchableOpacity
                            onPress={() => onChange({ ...config, icon: undefined })}
                            className="bg-surface px-3 py-2 rounded-lg border border-border"
                        >
                            <Text className="text-text-secondary text-sm font-medium">Clear Icon</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <NavIconPicker
                    visible={isIconPickerVisible}
                    currentIcon={config.icon || ''}
                    onSelect={(icon) => onChange({ ...config, icon })}
                    onClose={() => setIsIconPickerVisible(false)}
                />
            </View>

            {/* Style Variant */}
            <View>
                <Text className="text-white font-medium text-base mb-2">Style</Text>
                <View className="flex-row gap-2">
                    {(['default', 'solid', 'outline'] as const).map((v) => (
                        <TouchableOpacity
                            key={v}
                            onPress={() => onChange({ ...config, variant: v })}
                            className={`flex-1 px-3 py-3 rounded-lg border items-center justify-center ${
                                (config.variant || 'default') === v
                                    ? 'bg-primary border-primary'
                                    : 'bg-surface-highlight border-border'
                            }`}
                        >
                            <Text className={`text-xs font-medium ${
                                (config.variant || 'default') === v ? 'text-white' : 'text-text-secondary'
                            }`}>
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Rounding */}
            <View>
                <Text className="text-white font-medium text-base mb-2">Rounding</Text>
                <View className="flex-row gap-2">
                    {([
                        { value: 'none', label: 'Square', icon: 'square-outline' },
                        { value: 'sm', label: 'Small', icon: 'stop-outline' }, // Using stop-outline as a proxy for slightly rounded
                        { value: 'md', label: 'Medium', icon: 'tablet-landscape-outline' },
                        { value: 'full', label: 'Pill', icon: 'remove-outline' } // Pill shape
                    ] as const).map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            onPress={() => onChange({ ...config, rounding: option.value as any })}
                            className={`flex-1 px-2 py-3 rounded-lg border items-center justify-center ${
                                (config.rounding || 'sm') === option.value
                                    ? 'bg-primary border-primary'
                                    : 'bg-surface-highlight border-border'
                            }`}
                        >
                            <Ionicons
                                name={option.icon as any}
                                size={18}
                                color={(config.rounding || 'sm') === option.value ? 'white' : Colors.text.secondary}
                                style={{ marginBottom: 4 }}
                            />
                            <Text className={`text-[10px] font-medium ${
                                (config.rounding || 'sm') === option.value ? 'text-white' : 'text-text-secondary'
                            }`}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Color */}
            <View>
                <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-white font-medium text-base">Color</Text>
                    {showReset && onReset && (
                        <TouchableOpacity onPress={onReset}>
                            <Text className="text-primary text-xs font-medium">Reset Color</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <ColorPicker
                    value={config.color || ''}
                    onChange={(color) => onChange({ ...config, color })}
                />
            </View>
        </View>
    );
}
