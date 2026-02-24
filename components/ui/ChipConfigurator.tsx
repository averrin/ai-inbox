import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MetadataConfig } from '../../store/settings';
import { Colors } from './design-tokens';
import { ColorPicker } from './ColorPicker';
import { IconSelector } from './IconSelector';
import { MetadataChip } from './MetadataChip';
import { UniversalIcon } from './UniversalIcon';
import { AppButton, CloseButton } from './AppButton';

interface ChipConfiguratorProps {
    config: MetadataConfig;
    onChange: (config: MetadataConfig) => void;
    showReset?: boolean;
    onReset?: () => void;
    label?: string;
}

export function ChipConfigurator({ config, onChange, showReset, onReset, label }: ChipConfiguratorProps) {
    const insets = useSafeAreaInsets();

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
                            <AppButton
                                key={v}
                                title={v.charAt(0).toUpperCase() + v.slice(1)}
                                variant="secondary"
                                size="xs"
                                rounding="md"
                                selected={(config.variant || 'default') === v}
                                onPress={() => onChange({ ...config, variant: v })}
                            />
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
                            <AppButton
                                key={option.value}
                                title={option.label}
                                variant="secondary"
                                size="xs"
                                rounding="md"
                                selected={(config.rounding || 'sm') === option.value}
                                onPress={() => onChange({ ...config, rounding: option.value as any })}
                            />
                        ))}
                    </View>
                </View>
            </View>

            {/* Icon Selector */}
            <IconSelector
                value={config.icon}
                onChange={(icon) => onChange({ ...config, icon })}
                label="Icon"
            />


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
