import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckRun } from '../../../services/jules';
import { Colors } from '../../ui/design-tokens';

interface CheckStatusItemProps {
    check: CheckRun;
    compact?: boolean;
}

export function CheckStatusItem({ check, compact = false }: CheckStatusItemProps) {
    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const isActive = check.status === 'in_progress' || check.status === 'queued';
        let animation: Animated.CompositeAnimation | null = null;
        if (isActive) {
            animation = Animated.loop(
                Animated.timing(spinValue, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            );
            animation.start();
        } else {
            spinValue.setValue(0);
        }

        return () => {
            if (animation) animation.stop();
        };
    }, [check.status]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    const getIcon = () => {
        if (check.status === 'queued') return 'time-outline';
        if (check.status === 'in_progress') return 'sync';
        if (check.conclusion === 'success') return 'checkmark';
        if (check.conclusion === 'failure') return 'close';
        return 'ellipse';
    };

    const getColor = () => {
        if (check.status === 'queued') return Colors.text.tertiary;
        if (check.status === 'in_progress') return '#60a5fa';
        if (check.conclusion === 'success') return '#4ade80';
        if (check.conclusion === 'failure') return '#f87171';
        return Colors.text.tertiary;
    };

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(check.html_url)}
            className={`flex-row items-center justify-between ${compact ? 'mb-0.5' : 'mb-1'}`}
        >
            <View className="flex-row items-center flex-1">
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons
                        name={getIcon() as any}
                        size={14}
                        color={getColor()}
                    />
                </Animated.View>
                <Text className="text-text-secondary text-xs ml-2 flex-1" numberOfLines={1}>{check.name}</Text>
            </View>
            <Text className="text-secondary text-xs">{check.status}</Text>
        </TouchableOpacity>
    );
}
