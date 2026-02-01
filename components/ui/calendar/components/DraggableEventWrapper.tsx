import React, { useEffect } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
    withTiming,
    useDerivedValue,
    useAnimatedReaction,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';

interface DraggableEventWrapperProps {
    children: React.ReactNode;
    eventStart: Date;
    minHour: number;
    cellHeight: number;
    onDrop: (newDate: Date) => void;
    enabled?: boolean;
    style?: StyleProp<ViewStyle>;
}

export function DraggableEventWrapper({
    children,
    eventStart,
    minHour,
    cellHeight,
    onDrop,
    enabled = true,
    style,
}: DraggableEventWrapperProps) {
    const isPressed = useSharedValue(false);
    const translationY = useSharedValue(0);
    const startY = useSharedValue(0);

    // Calculate snap height (15 minutes)
    const SNAP_MINUTES = 15;
    const SNAP_HEIGHT = (cellHeight * SNAP_MINUTES) / 60;

    const handleDragEnd = (yDisplayOffset: number) => {
        // Calculate new time
        // original top + translationY

        // We need the original top position in minutes/pixels relative to the day container
        // But we are dragging relative to the initial position.

        // Calculate 15-min slots moved
        const slotsMoved = Math.round(yDisplayOffset / SNAP_HEIGHT);
        const minutesMoved = slotsMoved * SNAP_MINUTES;

        const newDate = dayjs(eventStart).add(minutesMoved, 'minute').toDate();

        onDrop(newDate);
    };

    const gesture = Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(300)
        .onStart(() => {
            isPressed.value = true;
            startY.value = translationY.value;
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        })
        .onUpdate((e) => {
            translationY.value = startY.value + e.translationY;
        })
        .onEnd(() => {
            isPressed.value = false;
            const finalTranslation = translationY.value;

            // Optimistic Snap: Calculate where it SHOULD be after drop
            const slotsMoved = Math.round(finalTranslation / SNAP_HEIGHT);
            const snappedTranslation = slotsMoved * SNAP_HEIGHT;

            translationY.value = withSpring(snappedTranslation);
            runOnJS(handleDragEnd)(finalTranslation);
        });

    // Reset translation when eventStart prop changes (meaning the drop was synced/applied)
    // This absorbs the "optimistic" translation back into the base top position
    // whenever the parent component re-renders with the new date.
    // We use useEffect because Date objects can't be sent to UI runtime worklets safely.
    useEffect(() => {
        translationY.value = 0;
    }, [eventStart.getTime()]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateY: translationY.value },
                { scale: withTiming(isPressed.value ? 1.1 : 1) },
            ],
            zIndex: isPressed.value ? 2000 : 1000,
            opacity: isPressed.value ? 0.8 : 1,
            // Add shadow when lifted
            shadowColor: '#000',
            shadowOffset: { width: 0, height: isPressed.value ? 5 : 0 },
            shadowOpacity: isPressed.value ? 0.3 : 0,
            shadowRadius: isPressed.value ? 5 : 0,
            elevation: isPressed.value ? 5 : 0,
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[animatedStyle, style]}>
                {children}
            </Animated.View>
        </GestureDetector>
    );
}
