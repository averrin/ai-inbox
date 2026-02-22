import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { LinkWithSource } from '../../services/linkService';
import Toast from 'react-native-toast-message';
import { useSettingsStore } from '../../store/settings';
import { Colors } from '../ui/design-tokens';
import { showAlert } from '../../utils/alert';

interface LinkItemProps {
    link: LinkWithSource;
    onDelete: (link: LinkWithSource) => void;
    onTagPress: (tag: string) => void;
}

export function LinkItem({ link, onDelete, onTagPress }: LinkItemProps) {
    const { tagConfig } = useSettingsStore();

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
        showAlert(
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

    const visibleTags = (link.tags || []).filter(tag => !tagConfig[tag]?.hidden);

    return (
        <View className="flex-row bg-surface/50 border border-border rounded-xl mb-3 overflow-hidden h-28">
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleOpen}
                className="flex-1 flex-row"
            >
                {/* Image Preview */}
                {link.image ? (
                    <View className="w-24 bg-background h-full">
                        <Image
                            source={{ uri: link.image }}
                            className="w-full h-full"
                            resizeMode="cover"
                        />
                    </View>
                ) : (
                    <View className="w-24 bg-background h-full items-center justify-center border-r border-border">
                        <Ionicons name="link-outline" size={32} color="#475569" />
                    </View>
                )}

                {/* Content */}
                <View className="flex-1 p-3 justify-between">
                    <View>
                        <Text className="text-white font-semibold text-sm leading-5 mb-1" numberOfLines={2}>
                            {link.title || 'Untitled Link'}
                        </Text>
                        <Text className="text-text-tertiary text-xs" numberOfLines={1}>
                            {getHostname(link.url)}
                        </Text>
                    </View>

                    {/* Tags */}
                    {visibleTags.length > 0 && (
                        <View className="flex-row flex-wrap gap-1 mt-1">
                            {visibleTags.slice(0, 3).map(tag => {
                                const config = tagConfig[tag];
                                const customStyle = config?.color ? {
                                    backgroundColor: `${config.color}33`,
                                    borderColor: `${config.color}66`,
                                } : undefined;
                                const textStyle = config?.color ? { color: config.color } : undefined;

                                return (
                                    <TouchableOpacity
                                        key={tag}
                                        onPress={() => onTagPress(tag)}
                                        className="bg-surface-highlight px-1.5 py-0.5 rounded text-xs border border-primary"
                                        style={customStyle}
                                    >
                                        <Text className="text-text-secondary text-[10px]" style={textStyle} numberOfLines={1}>#{tag}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                            {visibleTags.length > 3 && (
                                <Text className="text-secondary text-[10px] self-center">+{visibleTags.length - 3}</Text>
                            )}
                        </View>
                    )}
                </View>
            </TouchableOpacity>

            {/* Actions */}
            <View className="justify-between items-center border-l border-border/50 bg-surface/30 py-2 w-10">
                 <TouchableOpacity onPress={handleOpen} className="flex-1 justify-center items-center w-full">
                    <Ionicons name="open-outline" size={18} color="#818cf8" />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={handleCopy} className="flex-1 justify-center items-center w-full">
                    <Ionicons name="copy-outline" size={18} color={Colors.text.tertiary} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={handleDelete} className="flex-1 justify-center items-center w-full">
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                 </TouchableOpacity>
            </View>
        </View>
    );
}
