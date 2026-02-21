import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';

interface ErrorModalProps {
    visible: boolean;
    title: string;
    error: string | Error;
    onClose?: () => void;
}

export function ErrorModal({ visible, title, error, onClose }: ErrorModalProps) {
    if (!visible) return null;

    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = error instanceof Error ? error.stack : '';

    const copyError = async () => {
        await Clipboard.setStringAsync(`${errorMessage}\n\n${errorStack}`);
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/70 px-6">
                <View className="w-full bg-surface rounded-2xl p-6 border border-red-500/50 shadow-xl max-w-sm max-h-[80%]">
                    <View className="flex-row items-center justify-center mb-4">
                        <View className="w-12 h-12 rounded-full bg-red-500/20 items-center justify-center mr-3">
                            <Ionicons name="warning" size={24} color={Colors.error} />
                        </View>
                        <Text className="text-white font-bold text-xl flex-1">
                            {title}
                        </Text>
                    </View>

                    <ScrollView className="bg-black/20 rounded-lg p-3 mb-6 max-h-[300px]">
                        <Text className="text-red-300 font-mono text-sm">
                            {errorMessage}
                        </Text>
                        {errorStack ? (
                            <Text className="text-slate-500 font-mono text-xs mt-2">
                                {errorStack}
                            </Text>
                        ) : null}
                    </ScrollView>

                    <View className="flex-row gap-3">
                         <TouchableOpacity
                            onPress={copyError}
                            className="flex-1 bg-surface-highlight py-3 rounded-xl items-center justify-center flex-row"
                        >
                            <Ionicons name="copy-outline" size={18} color={Colors.text.primary} style={{ marginRight: 8 }} />
                            <Text className="text-text-primary font-bold">Copy</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 bg-red-500 py-3 rounded-xl items-center justify-center"
                        >
                            <Text className="text-white font-bold">Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
