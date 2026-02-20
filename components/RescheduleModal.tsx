import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './ui/design-tokens';

interface RescheduleModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (option: 'later' | 'tomorrow') => void;
    showLater?: boolean;
}

export function RescheduleModal({
    visible,
    onClose,
    onSelect,
    showLater = true
}: RescheduleModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-background w-full max-w-md p-6 rounded-3xl border border-border">
                    <Text className="text-white text-xl font-bold mb-4 text-center">Quick Reschedule</Text>

                    <Text className="text-text-secondary text-center mb-6">
                        Choose when to move this task.
                    </Text>

                    <View className="gap-3">
                        {showLater && (
                            <TouchableOpacity
                                onPress={() => onSelect('later')}
                                className="bg-surface p-4 rounded-xl border border-border flex-row items-center justify-between"
                            >
                                <View>
                                    <Text className="text-white font-semibold">Later Today</Text>
                                    <Text className="text-text-tertiary text-xs">Find a free slot +30m from now</Text>
                                </View>
                                <Ionicons name="time-outline" size={20} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => onSelect('tomorrow')}
                            className="bg-surface p-4 rounded-xl border border-border flex-row items-center justify-between"
                        >
                            <View>
                                <Text className="text-white font-semibold">Tomorrow</Text>
                                <Text className="text-text-tertiary text-xs">Find a free slot tomorrow morning</Text>
                            </View>
                            <Ionicons name="sunny-outline" size={20} color={Colors.text.tertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            className="mt-2 p-4 rounded-xl items-center"
                        >
                            <Text className="text-secondary font-semibold">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
