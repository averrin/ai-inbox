import React, { useState, useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { BaseListItem } from './BaseListItem';
import { ActionButton } from './ActionButton';

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
    const isAudio = file.mimeType.startsWith('audio/');
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState<number | null>(null);
    const [position, setPosition] = useState<number | null>(null);

    // Unload sound when unmounting
    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const handlePlayPause = async () => {
        if (sound) {
            if (isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
            } else {
                await sound.playAsync();
                setIsPlaying(true);
            }
        } else {
            // Load the sound
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: file.uri },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded) {
                        setDuration(status.durationMillis || null);
                        setPosition(status.positionMillis);
                        setIsPlaying(status.isPlaying);
                        if (status.didJustFinish) {
                            setIsPlaying(false);
                            newSound.setPositionAsync(0);
                        }
                    }
                }
            );
            setSound(newSound);
            setIsPlaying(true);
        }
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const leftIcon = isImage ? (
        <Image 
            source={{ uri: file.uri }} 
            className="w-full h-full"
            resizeMode="cover"
        />
    ) : isAudio ? (
         <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="white" />
    ) : (
        <Ionicons name="document-text" size={24} color="white" />
    );

    const subtitle = isAudio && duration ? (
        <Text className="text-text-secondary text-xs">
            {formatTime(position || 0)} / {formatTime(duration)}
        </Text>
    ) : (
        <Text className="text-text-tertiary text-xs">
            {(file.size / 1024).toFixed(1)} KB • {file.mimeType.split('/')[1] || 'file'}
        </Text>
    );

    const actions = showRemove && onRemove ? (
        <ActionButton onPress={onRemove} icon="trash-outline" variant="danger" />
    ) : null;

    return (
        <BaseListItem
            leftIcon={leftIcon}
            title={file.name}
            subtitle={subtitle}
            rightActions={actions}
            onPress={isAudio ? handlePlayPause : undefined}
            activeOpacity={isAudio ? 0.7 : 1}
        />
    );
}
