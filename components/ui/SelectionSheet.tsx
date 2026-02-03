import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SelectionOption {
    id: string;
    label: string;
    icon?: string;
    color?: string;
    destructive?: boolean;
}

interface SelectionSheetProps {
    visible: boolean;
    title: string;
    options: SelectionOption[];
    onSelect: (option: SelectionOption) => void;
    onClose: () => void;
}

export function SelectionSheet({ visible, title, options, onSelect, onClose }: SelectionSheetProps) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                className="flex-1 justify-end bg-black/50"
            >
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                    <View className="bg-slate-900 rounded-t-3xl border-t border-slate-700 p-4 pb-8">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-lg font-bold">{title}</Text>
                            <TouchableOpacity onPress={onClose} className="p-2">
                                <Ionicons name="close" size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="max-h-80">
                            {options.map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    onPress={() => {
                                        onSelect(option);
                                        onClose();
                                    }}
                                    className="flex-row items-center py-3 px-2 rounded-xl mb-1"
                                    style={{ backgroundColor: option.destructive ? 'rgba(239, 68, 68, 0.1)' : 'transparent' }}
                                >
                                    {option.icon && (
                                        <View
                                            className="w-10 h-10 rounded-full items-center justify-center mr-3"
                                            style={{ backgroundColor: option.color ? `${option.color}20` : '#334155' }}
                                        >
                                            <Ionicons
                                                name={option.icon as any}
                                                size={22}
                                                color={option.color || '#94a3b8'}
                                            />
                                        </View>
                                    )}
                                    <Text
                                        className="text-base font-medium"
                                        style={{ color: option.destructive ? '#ef4444' : option.color || '#e2e8f0' }}
                                    >
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}
