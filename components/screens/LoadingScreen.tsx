import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { JulesLoader } from '../ui/JulesLoader';

export function LoadingScreen({ message }: { message?: string }) {
    return (
        <Layout>
            <View className="flex-1 justify-center items-center">
                <JulesLoader size="large" message={message || "Analyzing Content..."}>
                    <Ionicons name="sparkles" size={48} color="white" />
                </JulesLoader>
            </View>
        </Layout>
    );
}
