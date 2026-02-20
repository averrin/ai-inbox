import React from 'react';
import { View, Text, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Layout } from '../ui/Layout';
import { Button } from '../ui/Button';
import Toast from 'react-native-toast-message';

interface ErrorScreenProps {
    onRetry: () => void;
    onClose: () => void;
    errorMessage?: string;
}

export function ErrorScreen({ onRetry, onClose, errorMessage }: ErrorScreenProps) {
    const handleCopyError = async () => {
        if (errorMessage) {
            await Clipboard.setStringAsync(errorMessage);
            Toast.show({
                type: 'success',
                text1: 'Error copied',
                text2: 'Error message copied to clipboard',
            });
        }
    };

    return (
        <Layout>
            <View className="flex-1 justify-center items-center px-6">
                <Text className="text-error text-lg font-bold mb-4">Analysis Failed</Text>

                {errorMessage && (
                    <View className="bg-surface p-4 rounded-xl border border-border w-full mb-6">
                         <Text className="text-text-secondary font-mono text-xs" numberOfLines={6}>
                             {errorMessage}
                         </Text>
                    </View>
                )}

                <View className="w-full gap-4">
                    {errorMessage && (
                        <Button
                            title="Copy Error Message"
                            onPress={handleCopyError}
                            variant="secondary"
                        />
                    )}
                    <Button title="Retry" onPress={onRetry} />
                    <Button title="Close" onPress={onClose} variant="secondary" />
                </View>
            </View>
        </Layout>
    );
}
