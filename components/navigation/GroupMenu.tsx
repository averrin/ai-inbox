import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavItemConfig } from '../../store/settings';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface GroupMenuProps {
    config: NavItemConfig;
    navigation: any;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function GroupMenu({ config, navigation }: GroupMenuProps) {
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();
    }, []);

    const handlePress = (screenId: string) => {
        // We navigate to the screen. Since the screen is technically part of the TabNavigator
        // (even if hidden), this should switch tabs.
        // However, we want to close this menu feel?
        // Since this menu IS a tab, navigating away automatically "closes" it by unmounting/hiding it.
        navigation.navigate(screenId);
    };

    return (
        <View className="flex-1 bg-slate-900/95 justify-end">
            <TouchableOpacity
                activeOpacity={1}
                className="flex-1"
                onPress={() => {
                    // Navigate back to default or previous tab?
                    // Usually "Schedule" is safe.
                    navigation.navigate('Schedule');
                }}
            />

            <Animated.View
                style={{
                    transform: [{ translateY: slideAnim }],
                    paddingBottom: insets.bottom + 80 // Extra padding to clear tab bar area visually
                }}
                className="bg-slate-800 rounded-t-3xl border-t border-slate-700 p-6 shadow-xl"
            >
                <View className="items-center mb-6">
                    <View className="w-12 h-1 bg-slate-600 rounded-full mb-4" />
                    <Text className="text-white text-xl font-bold">{config.title}</Text>
                </View>

                <View className="flex-row flex-wrap justify-center gap-4">
                    {config.children?.map((child) => (
                        <TouchableOpacity
                            key={child.id}
                            onPress={() => handlePress(child.id)}
                            className="items-center justify-center bg-slate-700/50 p-4 rounded-2xl w-[80px] h-[80px] border border-slate-600"
                        >
                            <Ionicons
                                // @ts-ignore
                                name={child.icon}
                                size={28}
                                color="#818cf8"
                            />
                            <Text
                                className="text-slate-300 text-xs mt-2 text-center"
                                numberOfLines={1}
                            >
                                {child.title}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </Animated.View>
        </View>
    );
}
