import React, { useState } from 'react';
import { TouchableOpacity, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from './design-tokens';
import { showError } from '../../utils/alert';

interface ImageAttachmentButtonProps {
    onImageSelected: (base64: string, mimeType?: string) => void;
    style?: any;
    className?: string;
    disabled?: boolean;
}

export function ImageAttachmentButton({ onImageSelected, style, className, disabled }: ImageAttachmentButtonProps) {
    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                onImageSelected(result.assets[0].base64, result.assets[0].mimeType);
            }
        } catch (e) {
            showError('Error', 'Failed to pick image');
        }
    };

    return (
        <TouchableOpacity
            onPress={pickImage}
            disabled={disabled}
            className={`p-2 bg-surface rounded-full border border-border items-center justify-center ${className || ''}`}
            style={style}
        >
            <Ionicons name="camera-outline" size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>
    );
}
