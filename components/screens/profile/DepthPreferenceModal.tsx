import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { Colors } from '../../ui/design-tokens';
import { MetadataChip } from '../../ui/MetadataChip';
import { getDepthLabel, getLevelChipProps } from './profileUtils';

interface DepthPreferenceModalProps {
    visible: boolean;
    onClose: () => void;
    config: {
        targetTopic?: string;
        abstractionLevel: number;
    };
    updateConfig: (updates: Partial<{ targetTopic: string; abstractionLevel: number }>) => void;
    onGenerate: () => void;
}

export const DepthPreferenceModal: React.FC<DepthPreferenceModalProps> = ({
    visible,
    onClose,
    config,
    updateConfig,
    onGenerate
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-center px-6">
                <View className="bg-background border border-border rounded-2xl p-6 shadow-2xl">
                    <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest mb-4">
                        Configure Questions
                    </Text>

                    <View className="bg-slate-950/50 rounded-xl border border-border p-4 mb-4">
                        <View className="mb-2">
                            <Text className="text-text-secondary font-semibold">Focus Topic (Optional)</Text>
                            <Text className="text-secondary text-xs">Guide the conversation</Text>
                        </View>
                        <TextInput
                            className="text-text-primary bg-background border border-border rounded-lg p-3"
                            placeholder="e.g. Childhood, Career, Dreams..."
                            placeholderTextColor={Colors.text.tertiary}
                            value={config.targetTopic || ''}
                            onChangeText={(text) => updateConfig({ targetTopic: text })}
                        />
                    </View>

                    <View className="bg-slate-950/50 rounded-xl border border-border p-4 mb-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <View>
                                <Text className="text-text-secondary font-semibold">Depth Preference</Text>
                                <Text className="text-secondary text-xs">AI curiosity level</Text>
                            </View>
                            <MetadataChip
                                label={getDepthLabel(config.abstractionLevel)}
                                color={getLevelChipProps(config.abstractionLevel).color}
                                variant={getLevelChipProps(config.abstractionLevel).variant}
                                size="sm"
                                rounding="full"
                            />
                        </View>

                        <View className="flex-row items-center gap-3">
                            <Text className="text-[10px] text-secondary font-bold uppercase tracking-wider">Low</Text>
                            <View className="flex-1 h-1.5 bg-slate-950 rounded-full flex-row overflow-hidden border border-border">
                                <TouchableOpacity
                                    className={`flex-1 ${config.abstractionLevel <= 0.33 ? 'bg-primary' : 'bg-transparent'}`}
                                    onPress={() => updateConfig({ abstractionLevel: 0.2 })}
                                />
                                <TouchableOpacity
                                    className={`flex-1 border-x border-border ${config.abstractionLevel > 0.33 && config.abstractionLevel <= 0.66 ? 'bg-primary' : 'bg-transparent'}`}
                                    onPress={() => updateConfig({ abstractionLevel: 0.5 })}
                                />
                                <TouchableOpacity
                                    className={`flex-1 ${config.abstractionLevel > 0.66 ? 'bg-primary' : 'bg-transparent'}`}
                                    onPress={() => updateConfig({ abstractionLevel: 0.8 })}
                                />
                            </View>
                            <Text className="text-[10px] text-secondary font-bold uppercase tracking-wider">High</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            className="flex-1 bg-surface py-4 rounded-xl items-center"
                            onPress={onClose}
                        >
                            <Text className="text-text-secondary font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="flex-1 bg-primary py-4 rounded-xl items-center"
                            onPress={() => {
                                onClose();
                                onGenerate();
                            }}
                        >
                            <Text className="text-white font-bold">Generate</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
