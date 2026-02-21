import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { AlertOption } from '../../store/ui';

interface AlertModalProps {
    visible: boolean;
    title: string;
    message?: string;
    options: AlertOption[];
    onClose?: () => void;
}

export function AlertModal({ visible, title, message, options = [], onClose }: AlertModalProps) {
    if (!visible) return null;

    // Default option if none provided
    const displayOptions = options.length > 0 ? options : [{ text: 'OK', onPress: onClose }];

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 justify-center items-center bg-black/70 px-6">
                <View className="w-full bg-surface rounded-2xl p-6 border border-border shadow-xl max-w-sm">
                    <Text className="text-text-primary font-bold text-lg mb-2 text-center">
                        {title}
                    </Text>
                    {message ? (
                        <Text className="text-text-secondary text-base mb-6 text-center leading-6">
                            {message}
                        </Text>
                    ) : null}

                    <View className={`flex-row flex-wrap justify-center gap-3 mt-2 ${displayOptions.length > 2 ? 'flex-col' : ''}`}>
                        {displayOptions.map((option, index) => {
                            const isDestructive = option.style === 'destructive';
                            const isCancel = option.style === 'cancel';

                            let bgClass = 'bg-surface-highlight';
                            let textClass = 'text-text-primary';

                            if (isDestructive) {
                                bgClass = 'bg-red-500/20';
                                textClass = 'text-red-500';
                            } else if (!isCancel) {
                                bgClass = 'bg-primary';
                                textClass = 'text-white';
                            }

                            const flexClass = displayOptions.length === 2 ? 'flex-1' : 'w-full';

                            return (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => {
                                        if (option.onPress) option.onPress();
                                        else if (onClose) onClose();
                                    }}
                                    className={`${bgClass} py-3 px-4 rounded-xl items-center justify-center ${flexClass}`}
                                >
                                    <Text className={`${textClass} font-bold text-base`}>
                                        {option.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
