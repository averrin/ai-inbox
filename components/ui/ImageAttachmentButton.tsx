import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSettingsStore } from '../../store/settings';
import { analyzeImage } from '../../services/gemini';

interface ImageAttachmentButtonProps {
    onAnalysisComplete: (text: string) => void;
    prompt?: string;
    style?: any;
    className?: string;
    disabled?: boolean;
}

export function ImageAttachmentButton({ onAnalysisComplete, prompt, style, className, disabled }: ImageAttachmentButtonProps) {
    const [analyzing, setAnalyzing] = useState(false);
    const { apiKey, selectedModel } = useSettingsStore();

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                analyze(result.assets[0].base64, result.assets[0].mimeType);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const analyze = async (base64: string, mimeType?: string) => {
        if (!apiKey) {
            Alert.alert('Error', 'API Key not configured');
            return;
        }
        setAnalyzing(true);
        try {
            const text = await analyzeImage(
                apiKey,
                base64,
                prompt || "Describe this image in detail.",
                mimeType,
                'gemini-1.5-flash' // Force a vision-capable model if selectedModel might not be one, or check capabilities
            );
            if (text) {
                onAnalysisComplete(text);
            } else {
                Alert.alert('Error', 'Failed to analyze image');
            }
        } catch (e) {
             Alert.alert('Error', 'Analysis failed');
        } finally {
            setAnalyzing(false);
        }
    }

    return (
        <TouchableOpacity
            onPress={pickImage}
            disabled={analyzing || disabled}
            className={`p-2 bg-slate-800 rounded-full border border-slate-700 items-center justify-center ${className || ''}`}
            style={style}
        >
            {analyzing ? (
                <ActivityIndicator size="small" color="#818cf8" />
            ) : (
                <Ionicons name="camera-outline" size={20} color="#94a3b8" />
            )}
        </TouchableOpacity>
    );
}
