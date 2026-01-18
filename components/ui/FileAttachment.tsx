import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';

interface FileAttachmentProps {
    file: {
        uri: string;
        name: string;
        size: number;
        mimeType: string;
    };
    onRemove?: () => void;
    showRemove?: boolean;
}

export function FileAttachment({ file, onRemove, showRemove = true }: FileAttachmentProps) {
    const isImage = file.mimeType.startsWith('image/');

    return (
        <View className="mb-2 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <View className="flex-row items-center gap-3">
                {/* Preview or Icon */}
                <View className="w-10 h-10 bg-slate-700 rounded-lg overflow-hidden items-center justify-center">
                    {isImage ? (
                        <Image 
                            source={{ uri: file.uri }} 
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <Text className="text-xl">📄</Text>
                    )}
                </View>

                {/* File Info */}
                <View className="flex-1">
                    <Text className="text-white font-medium text-sm" numberOfLines={1}>
                        {file.name}
                    </Text>
                    <Text className="text-slate-400 text-xs">
                        {(file.size / 1024).toFixed(1)} KB • {file.mimeType.split('/')[1] || 'file'}
                    </Text>
                </View>

                {/* Remove Button */}
                {showRemove && onRemove && (
                    <TouchableOpacity onPress={onRemove} className="p-1">
                        <Text className="text-red-400 font-bold text-lg">×</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
