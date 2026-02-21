import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, MetadataConfig } from '../store/settings';
import { Colors, Palette } from './ui/design-tokens';
import { ColorPicker } from './ui/ColorPicker';

interface TagPropertyConfigModalProps {
    visible: boolean;
    onClose: () => void;
    item: string;
    type: 'tags' | 'properties';
    knownValues?: string[]; // For properties
}

export function TagPropertyConfigModal({ visible, onClose, item, type, knownValues = [] }: TagPropertyConfigModalProps) {
    const { 
        tagConfig, 
        propertyConfig, 
        setTagConfig, 
        setPropertyConfig,
        removeTagConfig,
        removePropertyConfig
    } = useSettingsStore();

    const config = type === 'tags' ? (tagConfig?.[item] || {}) : (propertyConfig?.[item] || {});
    const updateFn = type === 'tags' ? setTagConfig : setPropertyConfig;
    const prefix = type === 'tags' ? '#' : '';

    const handleRemove = () => {
        Alert.alert(
            "Remove Configuration",
            "Are you sure you want to remove this configuration? This will revert the item to default appearance.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        if (type === 'tags') {
                            removeTagConfig(item);
                        } else {
                            removePropertyConfig(item);
                        }
                        onClose();
                    }
                }
            ]
        );
    };

    const updateValueConfig = (val: string, newConfig: MetadataConfig) => {
         const currentPropConfig = propertyConfig[item] || {};
         const currentValueConfigs = currentPropConfig.valueConfigs || {};
         
         setPropertyConfig(item, {
             ...currentPropConfig,
             valueConfigs: {
                 ...currentValueConfigs,
                 [val]: newConfig
             }
         });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-slate-950/80 justify-end">
                <View className="bg-background rounded-t-3xl border-t border-border max-h-[85%]">
                    
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-border">
                        <Text className="text-white text-xl font-bold">{prefix}{item}</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-surface rounded-full">
                            <Ionicons name="close" size={24} color={Colors.text.tertiary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                        {/* Visibility */}
                        <View className="bg-surface p-4 rounded-xl mb-4 border border-border">
                            <View className="flex-row items-center justify-between">
                                <View>
                                    <Text className="text-white font-medium text-base">Visibility</Text>
                                    <Text className="text-text-tertiary text-sm">Show this metadata in task lists</Text>
                                </View>
                                <Switch
                                    value={!config.hidden}
                                    onValueChange={(val) => updateFn(item, { ...config, hidden: !val })}
                                    trackColor={{ false: Colors.surfaceHighlight, true: Palette[14] }}
                                    thumbColor={!config.hidden ? '#e0e7ff' : Colors.text.tertiary}
                                />
                            </View>
                        </View>

                        {/* Property Type */}
                        {type === 'properties' && (
                            <View className="bg-surface p-4 rounded-xl mb-4 border border-border">
                                <Text className="text-white font-medium text-base mb-2">Property Type</Text>
                                <View className="flex-row gap-2">
                                    {['text', 'date', 'number', 'boolean'].map((t) => (
                                        <TouchableOpacity
                                            key={t}
                                            onPress={() => updateFn(item, { ...config, type: t as any })}
                                            className={`px-3 py-2 rounded-lg border ${
                                                (config.type || 'text') === t
                                                    ? 'bg-primary border-primary'
                                                    : 'bg-surface-highlight border-border'
                                            }`}
                                        >
                                            <Text className={`text-xs font-medium ${
                                                (config.type || 'text') === t ? 'text-white' : 'text-text-secondary'
                                            }`}>
                                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Style Variant */}
                        <View className="bg-surface p-4 rounded-xl mb-4 border border-border">
                            <Text className="text-white font-medium text-base mb-2">Style</Text>
                            <View className="flex-row gap-2">
                                {(['default', 'solid', 'outline'] as const).map((v) => (
                                    <TouchableOpacity
                                        key={v}
                                        onPress={() => updateFn(item, { ...config, variant: v })}
                                        className={`px-3 py-2 rounded-lg border ${
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

                        {/* Default Color */}
                        <View className="bg-surface p-4 rounded-xl mb-4 border border-border">
                            <View className="flex-row justify-between items-center mb-1">
                                <Text className="text-white font-medium text-base">Default Color</Text>
                                {config.color && (
                                    <TouchableOpacity onPress={() => updateFn(item, { ...config, color: undefined })}>
                                        <Text className="text-primary text-xs font-medium">Reset</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text className="text-text-tertiary text-sm mb-3">Applied to all instances unless overridden</Text>
                            <ColorPicker
                                value={config.color || ''}
                                onChange={(color) => updateFn(item, { ...config, color })}
                            />
                        </View>

                         {/* Property Values */}
                         {type === 'properties' && knownValues.length > 0 && (
                             <View className="bg-surface p-4 rounded-xl mb-4 border border-border">
                                <Text className="text-white font-medium text-base mb-1">Value Overrides</Text>
                                <Text className="text-text-tertiary text-sm mb-4">Set specific colors for specific values</Text>
                                
                                {knownValues.map(val => {
                                    const valConfig = config.valueConfigs?.[val] || {};
                                    return (
                                        <View key={val} className="mb-6 last:mb-0 border-t border-border pt-4 first:pt-0 first:border-t-0">
                                            <View className="flex-row items-center justify-between mb-2">
                                                <View className="flex-row items-center">
                                                    <Ionicons name="git-commit-outline" size={16} color={Colors.text.tertiary} className="mr-2"/>
                                                    <Text className="text-text-primary font-medium">{val}</Text>
                                                </View>
                                                {valConfig.color && (
                                                    <TouchableOpacity onPress={() => updateValueConfig(val, { ...valConfig, color: undefined })}>
                                                        <Text className="text-primary text-xs font-medium">Reset</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <ColorPicker
                                                value={valConfig.color || ''}
                                                onChange={(color) => updateValueConfig(val, { ...valConfig, color })}
                                            />
                                        </View>
                                    );
                                })}
                             </View>
                         )}

                        <TouchableOpacity
                            onPress={handleRemove}
                            className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl flex-row items-center justify-center mb-8"
                        >
                            <Ionicons name="trash-outline" size={20} color={Colors.error} className="mr-2" />
                            <Text className="text-error font-medium">Remove Configuration</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
