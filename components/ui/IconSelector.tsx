import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from './design-tokens';
import { IconPicker } from './IconPicker';
import { UniversalIcon } from './UniversalIcon';
import { CloseButton } from './AppButton';

interface IconSelectorProps {
    value?: string;
    onChange: (icon?: string) => void;
    label?: string;
    description?: string;
}

/**
 * A form control that displays the currently selected icon and opens a modal
 * picker to select a new one. Reuses the pattern from ChipConfigurator.
 */
export function IconSelector({ value, onChange, label = 'Icon', description }: IconSelectorProps) {
    const [isIconPickerVisible, setIsIconPickerVisible] = useState(false);
    const insets = useSafeAreaInsets();

    const handleIconSelect = (icon: string) => {
        onChange(icon);
        setIsIconPickerVisible(false);
    };

    return (
        <View>
            <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1 mr-3">
                    <Text className="text-white font-medium text-sm">{label}</Text>
                    {description && <Text className="text-secondary text-xs">{description}</Text>}
                </View>
                {value && (
                    <TouchableOpacity onPress={() => onChange(undefined)}>
                        <Text className="text-error text-xs font-medium">Remove</Text>
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity
                onPress={() => setIsIconPickerVisible(true)}
                className="flex-row items-center bg-surface-highlight border border-border rounded-xl p-3"
            >
                <View className="w-8 h-8 rounded-lg bg-surface items-center justify-center mr-3 border border-border">
                    {value ? (
                        <UniversalIcon name={value} size={20} color={Colors.text.primary} />
                    ) : (
                        <Ionicons name="add" size={20} color={Colors.text.tertiary} />
                    )}
                </View>
                <Text className="text-text-secondary text-sm flex-1">
                    {value ? value : 'Select an icon...'}
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
                        <CloseButton onPress={() => setIsIconPickerVisible(false)} />
                    </View>
                    <View className="flex-1 p-4">
                        <IconPicker
                            value={value || ''}
                            onChange={handleIconSelect}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
