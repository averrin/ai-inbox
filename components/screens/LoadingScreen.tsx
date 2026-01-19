import React from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';

function PulsingIcon() {
    const scale = useSharedValue(1);
    React.useEffect(() => {
        scale.value = withRepeat(withTiming(1.2, { duration: 1000, easing: Easing.ease }), -1, true);
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <View className="items-center justify-center p-10">
            <Animated.View style={style} className="w-24 h-24 bg-indigo-500 rounded-full opacity-30 absolute" />
            <View className="w-16 h-16 bg-indigo-400 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50">
                <Ionicons name="sparkles" size={32} color="white" />
            </View>
        </View>
    );
}

export function LoadingScreen() {
    return (
        <Layout>
            <View className="flex-1 justify-center items-center">
                <PulsingIcon />
                <Text className="text-white text-lg font-medium mt-4 animate-pulse">Analyzing Content...</Text>
            </View>
        </Layout>
    );
}
