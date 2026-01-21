import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

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
                    ) : isAudio ? (
                        <TouchableOpacity onPress={handlePlayPause} className="w-full h-full items-center justify-center">
                            <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="white" />
                        </TouchableOpacity>
                    ) : (
                        <Ionicons name="document-text" size={24} color="white" />
                    )}
                </View>

                {/* File Info */}
                <View className="flex-1">
                    <Text className="text-white font-medium text-sm" numberOfLines={1}>
                        {file.name}
                    </Text>
                    {isAudio && duration ? (
                        <Text className="text-indigo-300 text-xs">
                            {formatTime(position || 0)} / {formatTime(duration)}
                        </Text>
                    ) : (
                        <Text className="text-slate-400 text-xs">
                            {(file.size / 1024).toFixed(1)} KB • {file.mimeType.split('/')[1] || 'file'}
                        </Text>
                    )}
                </View>

                {/* Remove Button */}
                {showRemove && onRemove && (
                    <TouchableOpacity onPress={onRemove} className="p-1">
                        <Ionicons name="close" size={20} color="#f87171" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
