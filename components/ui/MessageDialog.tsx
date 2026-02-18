import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';

interface MessageDialogProps {
    visible: boolean;
    onClose: () => void;
    onSend: (message: string) => void;
    sending: boolean;
    title?: string;
    placeholder?: string;
    sendLabel?: string;
}

export function MessageDialog({
    visible,
    onClose,
    onSend,
    sending,
    title = "Send Message",
    placeholder = "Type your message...",
    sendLabel = "Send"
}: MessageDialogProps) {
    const [message, setMessage] = useState('');

    const handleSend = () => {
        if (message.trim()) {
            onSend(message);
            setMessage('');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 bg-black/80 justify-center px-4">
                <View className="bg-slate-900 rounded-2xl p-4 border border-slate-700">
                    <Text className="text-white font-bold text-lg mb-4">{title}</Text>
                    <TextInput
                        className="bg-slate-800 text-white p-3 rounded-lg min-h-[100px] mb-4"
                        placeholder={placeholder}
                        placeholderTextColor="#94a3b8"
                        multiline
                        textAlignVertical="top"
                        value={message}
                        onChangeText={setMessage}
                        autoFocus
                    />
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={onClose} className="flex-1 bg-slate-800 py-3 rounded-xl items-center" disabled={sending}>
                            <Text className="text-white font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSend} className="flex-1 bg-indigo-600 py-3 rounded-xl items-center" disabled={sending || !message.trim()}>
                            {sending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">{sendLabel}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
