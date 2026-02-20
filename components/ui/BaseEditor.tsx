import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BaseEditorProps<T> {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    onAdd: () => void;
    label?: string;
    addLabel?: string;
    addIcon?: keyof typeof Ionicons.prototype.props.name;
    modalTitle: string;
    isModalVisible: boolean;
    onCloseModal: () => void;
    onConfirm: () => void;
    children: React.ReactNode; // Input area
    suggestions?: React.ReactNode;
}

export function BaseEditor<T>({
    items,
    renderItem,
    onAdd,
    label,
    addLabel = 'Add',
    addIcon = 'add',
    modalTitle,
    isModalVisible,
    onCloseModal,
    onConfirm,
    children,
    suggestions
}: BaseEditorProps<T>) {
    return (
        <View className="mt-2 mb-1">
            {label && (
                <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">{label}</Text>
            )}
            
            <View className="flex-row flex-wrap gap-2">
                {items.map((item, index) => renderItem(item, index))}
                
                <TouchableOpacity
                    onPress={onAdd}
                    className="bg-surface-highlight px-2.5 py-1 rounded-md flex-row items-center border border-border"
                >
                    <Ionicons name={addIcon as any} size={12} color="white" />
                    <Text className="text-white text-xs font-medium ml-1">{addLabel}</Text>
                </TouchableOpacity>
            </View>

            <Modal 
                visible={isModalVisible} 
                transparent 
                animationType="fade" 
                onRequestClose={onCloseModal}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center items-center bg-black/50"
                >
                    <View className="bg-background rounded-3xl p-6 w-[85%] max-w-md border border-border">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">{modalTitle}</Text>
                            <TouchableOpacity onPress={onCloseModal}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        
                        {children}

                        <View className="flex-row gap-3 mt-4">
                            <TouchableOpacity
                                onPress={onCloseModal}
                                className="flex-1 bg-surface p-4 rounded-xl items-center"
                            >
                                <Text className="text-white font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onConfirm}
                                className="flex-1 bg-primary p-4 rounded-xl items-center"
                            >
                                <Text className="text-white font-semibold">Confirm</Text>
                            </TouchableOpacity>
                        </View>

                        {suggestions && (
                            <View className="mt-4">
                                {suggestions}
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
