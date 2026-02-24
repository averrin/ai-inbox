import React from 'react';
import { View, Text, Modal, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

interface ProfileImageModalProps {
    visible: boolean;
    onClose: () => void;
    imageUrl: string | null;
    onShare: () => void;
    onCopy: () => void;
    onRegenerate: () => void;
    isGenerating: boolean;
    animatedStyle: any;
    gesture: any;
}

export const ProfileImageModal: React.FC<ProfileImageModalProps> = ({
    visible,
    onClose,
    imageUrl,
    onShare,
    onCopy,
    onRegenerate,
    isGenerating,
    animatedStyle,
    gesture
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View className="flex-1 bg-black/95 justify-center overflow-hidden">
                    <TouchableOpacity
                        className="absolute top-12 right-6 z-10 p-2 bg-background/50 rounded-full border border-border"
                        onPress={onClose}
                    >
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>

                    {imageUrl && (
                        <GestureDetector gesture={gesture}>
                            <Animated.View style={[animatedStyle, { width: '100%', height: '80%', justifyContent: 'center' }]}>
                                <Image
                                    source={{ uri: imageUrl }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </GestureDetector>
                    )}

                    <View className="absolute bottom-10 left-0 right-0 items-center">
                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                className="bg-background px-4 py-3 rounded-full border border-border flex-row items-center gap-2"
                                onPress={onShare}
                            >
                                <Ionicons name="share-outline" size={18} color="#818cf8" />
                                <Text className="text-text-primary font-medium">Share</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="bg-background px-4 py-3 rounded-full border border-border flex-row items-center gap-2"
                                onPress={onCopy}
                            >
                                <Ionicons name="copy-outline" size={18} color="#818cf8" />
                                <Text className="text-text-primary font-medium">Copy</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="bg-background px-4 py-3 rounded-full border border-border flex-row items-center gap-2"
                                onPress={onRegenerate}
                                disabled={isGenerating}
                            >
                                <Ionicons name="refresh" size={18} color="#818cf8" />
                                <Text className="text-text-primary font-medium">Regenerate</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};
