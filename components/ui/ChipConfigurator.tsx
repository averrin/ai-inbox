import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MetadataConfig } from '../../store/settings';
import { Colors } from './design-tokens';
import { ColorPicker } from './ColorPicker';
import { IconPicker } from './IconPicker';
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
    const insets = useSafeAreaInsets();

    const handleIconSelect = (icon: string) => {
        onChange({ ...config, icon });
        setIsIconPickerVisible(false);
    };

    return (
        <View className="gap-6 pb-8">
            {/* Preview Section - Compact */}
            <View className="bg-surface p-3 rounded-xl border border-border flex-row items-center justify-between">
                <Text className="text-text-tertiary text-xs uppercase font-bold">Preview</Text>
                <MetadataChip
                    label={label || 'Example'}
                    color={config.color}
                    variant={config.variant || 'default'}
                    rounding={config.rounding || 'sm'}
                    icon={config.icon}
                    size="md"
                />
            </View>

            {/* Layout: Style & Rounding Side-by-Side */}
            <View className="flex-row gap-4">
                {/* Style Variant */}
                <View className="flex-1">
                    <Text className="text-white font-medium text-sm mb-2">Style</Text>
                    <View className="gap-2">
                        {(['default', 'solid', 'outline'] as const).map((v) => (
                            <TouchableOpacity
                                key={v}
                                onPress={() => onChange({ ...config, variant: v })}
                                className={`px-3 py-2 rounded-lg border items-center justify-center ${
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
                <View className="flex-1">
                    <Text className="text-white font-medium text-sm mb-2">Rounding</Text>
                    <View className="gap-2">
                        {([
                            { value: 'none', label: 'Square' },
                            { value: 'sm', label: 'Small' },
                            { value: 'md', label: 'Medium' },
                            { value: 'full', label: 'Pill' }
                        ] as const).map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => onChange({ ...config, rounding: option.value as any })}
                                className={`px-3 py-2 rounded-lg border items-center justify-center ${
                                    (config.rounding || 'sm') === option.value
                                        ? 'bg-primary border-primary'
                                        : 'bg-surface-highlight border-border'
                                }`}
                            >
                                <Text className={`text-xs font-medium ${
                                    (config.rounding || 'sm') === option.value ? 'text-white' : 'text-text-secondary'
                                }`}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </View>

            {/* Icon Selector */}
            <View>
                <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-white font-medium text-sm">Icon</Text>
                    {config.icon && (
                        <TouchableOpacity onPress={() => onChange({ ...config, icon: undefined })}>
                            <Text className="text-error text-xs font-medium">Remove</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    onPress={() => setIsIconPickerVisible(true)}
                    className="flex-row items-center bg-surface-highlight border border-border rounded-xl p-3"
                >
                    <View className="w-8 h-8 rounded-lg bg-surface items-center justify-center mr-3 border border-border">
                        {config.icon ? (
                            <Ionicons name={config.icon as any} size={20} color={Colors.text.primary} />
                        ) : (
                            <Ionicons name="add" size={20} color={Colors.text.tertiary} />
                        )}
                    </View>
                    <Text className="text-text-secondary text-sm flex-1">
                        {config.icon ? config.icon : 'Select an icon...'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
                </TouchableOpacity>

                <Modal
                    visible={isIconPickerVisible}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setIsIconPickerVisible(false)}
                >
                    <View className="flex-1 bg-background">
                         <View className="px-4 py-4 border-b border-border flex-row items-center justify-between" style={{ marginTop: insets.top }}>
                            <Text className="text-white font-bold text-lg">Select Icon</Text>
                            <TouchableOpacity
                                onPress={() => setIsIconPickerVisible(false)}
                                className="bg-surface p-2 rounded-full"
                            >
                                <Ionicons name="close" size={20} color={Colors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                        <View className="flex-1 p-4">
                            <IconPicker
                                value={config.icon || ''}
                                onChange={handleIconSelect}
                            />
                        </View>
                    </View>
                </Modal>
            </View>

            {/* Color */}
            <View>
                <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-white font-medium text-sm">Color</Text>
                    {showReset && onReset && (
                        <TouchableOpacity onPress={onReset}>
                            <Text className="text-primary text-xs font-medium">Reset Default</Text>
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
