import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, MetadataConfig } from '../store/settings';

const PALETTE = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#64748b', // slate-500
];

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
        setPropertyConfig 
    } = useSettingsStore();

    const config = type === 'tags' ? (tagConfig?.[item] || {}) : (propertyConfig?.[item] || {});
    const updateFn = type === 'tags' ? setTagConfig : setPropertyConfig;
    const prefix = type === 'tags' ? '#' : '';

    const renderColorPicker = (
        identifier: string, // Not used in display, but for logic if needed
        currentConfig: MetadataConfig, 
        update: (newConfig: MetadataConfig) => void
    ) => {
        return (
            <View className="flex-row flex-wrap gap-2 mt-2">
                <TouchableOpacity
                    onPress={() => update({ ...currentConfig, color: undefined })}
                    className={`w-8 h-8 rounded-full border items-center justify-center ${!currentConfig?.color ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-600 bg-slate-800'}`}
                >
                    {!currentConfig?.color && <Ionicons name="close" size={16} color="#818cf8" />}
                </TouchableOpacity>
                {PALETTE.map(color => (
                    <TouchableOpacity
                        key={color}
                        onPress={() => update({ ...currentConfig, color })}
                        style={{ backgroundColor: color }}
                        className={`w-8 h-8 rounded-full ${currentConfig?.color === color ? 'border-2 border-white' : ''}`}
                    />
                ))}
            </View>
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
                <View className="bg-slate-900 rounded-t-3xl border-t border-slate-800 max-h-[85%]">
                    
                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-slate-800">
                        <Text className="text-white text-xl font-bold">{prefix}{item}</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <Ionicons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="p-4" contentContainerStyle={{ paddingBottom: 40 }}>
                        {/* Visibility */}
                        <View className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700">
                            <View className="flex-row items-center justify-between">
                                <View>
                                    <Text className="text-white font-medium text-base">Visibility</Text>
                                    <Text className="text-slate-400 text-sm">Show this metadata in task lists</Text>
                                </View>
                                <Switch
                                    value={!config.hidden}
                                    onValueChange={(val) => updateFn(item, { ...config, hidden: !val })}
                                    trackColor={{ false: '#334155', true: '#6366f1' }}
                                    thumbColor={!config.hidden ? '#e0e7ff' : '#94a3b8'}
                                />
                            </View>
                        </View>

                        {/* Default Color */}
                        <View className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700">
                            <Text className="text-white font-medium text-base mb-1">Default Color</Text>
                            <Text className="text-slate-400 text-sm mb-3">Applied to all instances unless overridden</Text>
                            {renderColorPicker(item, config, (newCfg) => updateFn(item, newCfg))}
                        </View>

                         {/* Property Values */}
                         {type === 'properties' && knownValues.length > 0 && (
                             <View className="bg-slate-800 p-4 rounded-xl mb-4 border border-slate-700">
                                <Text className="text-white font-medium text-base mb-1">Value Overrides</Text>
                                <Text className="text-slate-400 text-sm mb-4">Set specific colors for specific values</Text>
                                
                                {knownValues.map(val => {
                                    const valConfig = config.valueConfigs?.[val] || {};
                                    return (
                                        <View key={val} className="mb-6 last:mb-0 border-t border-slate-700 pt-4 first:pt-0 first:border-t-0">
                                            <View className="flex-row items-center mb-2">
                                                <Ionicons name="git-commit-outline" size={16} color="#94a3b8" className="mr-2"/>
                                                <Text className="text-slate-200 font-medium">{val}</Text>
                                            </View>
                                            {renderColorPicker(
                                                val, 
                                                valConfig, 
                                                (newCfg) => updateValueConfig(val, newCfg)
                                            )}
                                        </View>
                                    );
                                })}
                             </View>
                         )}

                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
