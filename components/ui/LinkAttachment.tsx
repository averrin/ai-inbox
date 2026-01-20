import React from 'react';
import { View, Text, TouchableOpacity, Image, Linking } from 'react-native';
import { URLMetadata } from '../../utils/urlMetadata';

interface LinkAttachmentProps {
    link: URLMetadata;
    onRemove?: () => void;
    showRemove?: boolean;
}

export function LinkAttachment({ link, onRemove, showRemove = true }: LinkAttachmentProps) {
    const handlePress = () => {
        Linking.openURL(link.url).catch(err => console.error("Failed to open URL:", err));
    };

    // Extract domain for display
    let domain = '';
    try {
        const urlObj = new URL(link.url);
        domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
        domain = link.url;
    }

    return (
        <View className="mb-2 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <View className="flex-row items-center gap-3">
                {/* Preview or Icon */}
                <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={handlePress}
                    className="w-10 h-10 bg-slate-700 rounded-lg overflow-hidden items-center justify-center"
                >
                    {link.image ? (
                        <Image 
                            source={{ uri: link.image }} 
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    ) : link.favicon ? (
                        <Image 
                            source={{ uri: link.favicon }} 
                            className="w-full h-full"
                            resizeMode="contain"
                        />
                    ) : (
                        <Text className="text-xl">🔗</Text>
                    )}
                </TouchableOpacity>

                {/* Link Info */}
                <TouchableOpacity 
                    className="flex-1" 
                    activeOpacity={0.7}
                    onPress={handlePress}
                >
                    <Text className="text-white font-medium text-sm" numberOfLines={1}>
                        {link.title || link.url}
                    </Text>
                    <Text className="text-indigo-300 text-xs" numberOfLines={1}>
                        {domain}
                    </Text>
                </TouchableOpacity>

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
