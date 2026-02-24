import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SessionActionMenuProps {
    visible: boolean;
    onClose: () => void;
    actions: {
        label: string;
        icon: string;
        onPress: () => void;
        color?: string;
        disabled?: boolean;
    }[];
}

export function SessionActionMenu({ visible, onClose, actions }: SessionActionMenuProps) {
    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={onClose}>
                <View className="bg-background rounded-t-2xl p-4 pb-10 border-t border-border">
                    <View className="items-center mb-4">
                        <View className="w-10 h-1 bg-surface-highlight rounded-full" />
                    </View>
                    {actions.map((action, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => {
                                if (!action.disabled) {
                                    action.onPress();
                                    onClose();
                                }
                            }}
                            className={`flex-row items-center py-4 border-b border-border ${action.disabled ? 'opacity-50' : ''}`}
                            disabled={action.disabled}
                        >
                            <Ionicons name={action.icon as any} size={20} color={action.color || "white"} style={{ marginRight: 16 }} />
                            <Text className={`text-base font-medium ${action.color ? '' : 'text-white'}`} style={action.color ? { color: action.color } : {}}>{action.label}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={onClose} className="mt-4 py-3 bg-surface rounded-xl items-center">
                        <Text className="text-white font-bold">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
