import React from 'react';
import { View, Text, Image, Linking } from 'react-native';
import { URLMetadata } from '../../utils/urlMetadata';
import { BaseListItem } from './BaseListItem';
import { ActionButton } from './ActionButton';

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

    const leftIcon = link.image ? (
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
    );

    const actions = showRemove && onRemove ? (
        <ActionButton onPress={onRemove} icon="trash-outline" variant="danger" />
    ) : null;

    return (
        <BaseListItem
            leftIcon={leftIcon}
            title={link.title || link.url}
            subtitle={domain}
            rightActions={actions}
            onPress={handlePress}
        />
    );
}
