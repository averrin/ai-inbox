import React from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { LinkWithSource } from '../../services/linkService';
import Toast from 'react-native-toast-message';

interface LinkItemProps {
    link: LinkWithSource;
    onDelete: (link: LinkWithSource) => void;
}

export function LinkItem({ link, onDelete }: LinkItemProps) {
    const handleOpen = () => {
        Linking.openURL(link.url).catch(err => {
             Toast.show({ type: 'error', text1: 'Could not open URL' });
        });
    };

    const handleCopy = async () => {
        await Clipboard.setStringAsync(link.url);
        Toast.show({ type: 'success', text1: 'Copied to clipboard' });
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Link",
            "Are you sure you want to remove this link?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => onDelete(link) }
            ]
        );
    };

    const getHostname = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    return (
        <View className="flex-row bg-slate-800/50 border border-slate-700 rounded-xl mb-3 overflow-hidden h-28">
            {/* Image Preview */}
            {link.image ? (
                 <View className="w-24 bg-slate-900 h-full">
                    <Image
                        source={{ uri: link.image }}
                        className="w-full h-full"
                        resizeMode="cover"
                    />
                 </View>
            ) : (
                <View className="w-24 bg-slate-900 h-full items-center justify-center border-r border-slate-800">
                    <Ionicons name="link-outline" size={32} color="#475569" />
                </View>
            )}

            {/* Content */}
            <View className="flex-1 p-3 justify-between">
                <View>
                    <Text className="text-white font-semibold text-sm leading-5 mb-1" numberOfLines={2}>
                        {link.title || 'Untitled Link'}
                    </Text>
                    <Text className="text-slate-400 text-xs" numberOfLines={1}>
                        {getHostname(link.url)}
                    </Text>
                </View>

                {/* Tags */}
                {link.tags && link.tags.length > 0 && (
                     <View className="flex-row flex-wrap gap-1 mt-1">
                        {link.tags.slice(0, 3).map(tag => (
                            <View key={tag} className="bg-indigo-900/50 px-1.5 py-0.5 rounded text-xs border border-indigo-500/30">
                                <Text className="text-indigo-300 text-[10px]" numberOfLines={1}>#{tag}</Text>
                            </View>
                        ))}
                         {link.tags.length > 3 && (
                            <Text className="text-slate-500 text-[10px] self-center">+{link.tags.length - 3}</Text>
                        )}
                     </View>
                )}
            </View>

            {/* Actions */}
            <View className="justify-between items-center border-l border-slate-700/50 bg-slate-800/30 py-2 w-10">
                 <TouchableOpacity onPress={handleOpen} className="flex-1 justify-center items-center w-full">
                    <Ionicons name="open-outline" size={18} color="#818cf8" />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={handleCopy} className="flex-1 justify-center items-center w-full">
                    <Ionicons name="copy-outline" size={18} color="#94a3b8" />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={handleDelete} className="flex-1 justify-center items-center w-full">
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                 </TouchableOpacity>
            </View>
        </View>
    );
}
