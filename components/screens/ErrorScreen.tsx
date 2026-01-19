import React from 'react';
import { View, Text } from 'react-native';
import { Layout } from '../ui/Layout';
import { Button } from '../ui/Button';

interface ErrorScreenProps {
    onRetry: () => void;
    onClose: () => void;
}

export function ErrorScreen({ onRetry, onClose }: ErrorScreenProps) {
    return (
        <Layout>
            <View className="flex-1 justify-center items-center">
                <Text className="text-red-400">Failed to generate content.</Text>
                <Button title="Retry" onPress={onRetry} variant="secondary" />
                <View className="h-4" />
                <Button title="Close" onPress={onClose} variant="secondary" />
            </View>
        </Layout>
    );
}
