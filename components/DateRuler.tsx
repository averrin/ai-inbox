import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DateRulerProps {
    date: Date;
    onDateChange: (date: Date) => void;
    onSettingsPress?: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_WIDTH = 60; // Approximate width of a day item
const VISIBLE_DAYS = 7; // Number of days to render around selected date

export const DateRuler: React.FC<DateRulerProps> = ({ date, onDateChange, onSettingsPress }) => {
    // Generate dates around the current date
    const dates = React.useMemo(() => {
        const result = [];
        const start = dayjs(date).subtract(Math.floor(VISIBLE_DAYS / 2), 'day');
        for (let i = 0; i < VISIBLE_DAYS; i++) {
            result.push(start.add(i, 'day'));
        }
        return result;
    }, [date]);

    // Animation for swipe feedback
    const translateX = useSharedValue(0);

    const handleNextDay = () => {
        const nextDate = dayjs(date).add(1, 'day').toDate();
        onDateChange(nextDate);
    };

    const handlePrevDay = () => {
        const prevDate = dayjs(date).subtract(1, 'day').toDate();
        onDateChange(prevDate);
    };

    const handleDatePress = (newDate: Date) => {
        onDateChange(newDate);
    };

    // Swipe gesture
    const pan = Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onUpdate((event) => {
            translateX.value = event.translationX;
        })
        .onEnd((event) => {
            if (event.translationX > 50) {
                runOnJS(handlePrevDay)();
            } else if (event.translationX < -50) {
                runOnJS(handleNextDay)();
            }
            translateX.value = withSpring(0);
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));
    const insets = useSafeAreaInsets();

    return (
        <View className="bg-slate-900 border-b border-slate-800 pb-4" style={{ paddingTop: insets.top }}>
            {/* Header with Month/Year and Buttons */}
            <View className="flex-row justify-between items-center px-4 py-2">
                <Text className="text-white text-lg font-bold">
                    {dayjs(date).format('MMMM YYYY')}
                </Text>
                <View className="flex-row gap-2">
                    <TouchableOpacity onPress={handlePrevDay} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="chevron-back" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDateChange(new Date())} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="today" size={20} color="#818cf8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleNextDay} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                    </TouchableOpacity>
                    {onSettingsPress && (
                        <TouchableOpacity onPress={onSettingsPress} className="p-2 bg-slate-800 rounded-full ml-2">
                            <Ionicons name="options-outline" size={20} color="#818cf8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Swipeable Date Strip */}
            <GestureDetector gesture={pan}>
                <Animated.View style={[styles.container, animatedStyle]}>
                    <View className="flex-row justify-between px-2">
                        {dates.map((d, index) => {
                            const isSelected = d.isSame(date, 'day');
                            const isToday = d.isSame(dayjs(), 'day');
                            const isWeekend = d.day() === 6 || d.day() === 0;
                            const backgroundColor = isSelected ? 'bg-indigo-600' : isWeekend ? 'bg-slate-700' : 'bg-slate-800';

                            return (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => handleDatePress(d.toDate())}
                                    className={`items-center justify-center w-12 h-14 rounded-xl ${backgroundColor} mx-1`}
                                >
                                    <Text className={`text-xs ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                        {d.format('ddd')}
                                    </Text>
                                    <Text className={`text-lg font-bold ${isSelected ? 'text-white' : isToday ? 'text-indigo-400' : 'text-slate-200'
                                        }`}>
                                        {d.format('D')}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // purely for structure, tailwind does the rest
    }
});
