import React, { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { ImageAttachmentButton } from './ImageAttachmentButton';
import { Ionicons } from '@expo/vector-icons';
import { analyzeImage } from '../../services/gemini';
import { useSettingsStore } from '../../store/settings';

interface MessageDialogProps {
    visible: boolean;
    onClose: () => void;
    onSend: (message: string) => void;
    sending: boolean;
    title?: string;
    placeholder?: string;
    sendLabel?: string;
    enableImageAttachment?: boolean;
    imagePrompt?: string;
}

export function MessageDialog({
    visible,
    onClose,
    onSend,
    sending,
    title = "Send Message",
    placeholder = "Type your message...",
    sendLabel = "Send",
    enableImageAttachment = false,
    imagePrompt
}: MessageDialogProps) {
    const [message, setMessage] = useState('');
    const [selectedImage, setSelectedImage] = useState<{ base64: string, mimeType?: string } | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const { apiKey, selectedModel } = useSettingsStore();

    const handleSend = async () => {
        if (!message.trim() && !selectedImage) return;

        if (selectedImage) {
            if (!apiKey) {
                Alert.alert('Error', 'API Key not configured');
                return;
            }
            setAnalyzing(true);
            try {
                const analysis = await analyzeImage(
                    apiKey,
                    selectedImage.base64,
                    message.trim() ? `Context: ${message.trim()}\n\n${imagePrompt || "Analyze this image."}` : (imagePrompt || "Analyze this image."),
                    selectedImage.mimeType,
                    selectedModel || 'gemini-1.5-flash'
                );

                if (analysis) {
                    const combinedMessage = message.trim()
                        ? `${message.trim()}\n\n[Image Analysis]: ${analysis}`
                        : `[Image Analysis]: ${analysis}`;
                    onSend(combinedMessage);
                    setMessage('');
                    setSelectedImage(null);
                } else {
                    Alert.alert('Error', 'Failed to analyze image');
                }
            } catch (e) {
                Alert.alert('Error', 'Image analysis failed');
            } finally {
                setAnalyzing(false);
            }
        } else {
            onSend(message);
            setMessage('');
        }
    };

    const close = () => {
        setSelectedImage(null);
        setMessage('');
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
            <View className="flex-1 bg-black/80 justify-center px-4">
                <View className="bg-slate-900 rounded-2xl p-4 border border-slate-700">
                    <Text className="text-white font-bold text-lg mb-4">{title}</Text>

                    {selectedImage && (
                        <View className="mb-4 relative rounded-lg overflow-hidden h-40 bg-slate-950 items-center justify-center border border-slate-800">
                            <Image
                                source={{ uri: `data:${selectedImage.mimeType || 'image/jpeg'};base64,${selectedImage.base64}` }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="contain"
                            />
                            <TouchableOpacity
                                onPress={() => setSelectedImage(null)}
                                className="absolute top-2 right-2 bg-black/50 p-1 rounded-full"
                            >
                                <Ionicons name="close" size={16} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}

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
                         {enableImageAttachment && (
                            <ImageAttachmentButton
                                onImageSelected={(base64, mimeType) => setSelectedImage({ base64, mimeType })}
                                className={`bg-slate-800 w-12 items-center justify-center rounded-xl ${selectedImage ? 'bg-indigo-500/20 border-indigo-500' : ''}`}
                                disabled={sending || analyzing}
                            />
                        )}
                        <TouchableOpacity onPress={close} className="flex-1 bg-slate-800 py-3 rounded-xl items-center" disabled={sending || analyzing}>
                            <Text className="text-white font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSend} className="flex-1 bg-indigo-600 py-3 rounded-xl items-center" disabled={sending || analyzing || (!message.trim() && !selectedImage)}>
                            {sending || analyzing ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">{sendLabel}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
