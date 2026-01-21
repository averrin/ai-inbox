import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withTiming,
    Easing,
    cancelAnimation,
    runOnJS
} from 'react-native-reanimated';

interface LongPressButtonProps {
    onPress: () => void;
    onLongPress: () => void;
    shortPressLabel: string;
    longPressLabel: string;
    longPressDuration?: number; // milliseconds
    style?: any;
    children?: React.ReactNode;
}

export function LongPressButton({
    onPress,
    onLongPress,
    shortPressLabel,
    longPressLabel,
    longPressDuration = 800,
    disabled = false,
    style,
    children
}: LongPressButtonProps) {
    const [isPressed, setIsPressed] = useState(false);
    const progress = useSharedValue(0);
    const pressStartTime = useRef<number>(0);
    const longPressTriggered = useRef(false);
    const animationTimeout = useRef<NodeJS.Timeout | null>(null);

    const animatedStyle = useAnimatedStyle(() => ({
        width: `${progress.value}%`,
    }));

    const SHORT_PRESS_THRESHOLD = 150; // ms before animation/long press logic starts

    const handlePressIn = () => {
        pressStartTime.current = Date.now();
        longPressTriggered.current = false;
        
        // Delay showing "pressed" state and animation
        animationTimeout.current = setTimeout(() => {
            setIsPressed(true);
            
            // Start progress animation
            // Calculate remaining duration: total - delay
            const remainingDuration = longPressDuration - SHORT_PRESS_THRESHOLD;
            
            progress.value = withTiming(100, {
                duration: remainingDuration,
                easing: Easing.linear,
            }, (finished) => {
                if (finished && !longPressTriggered.current) {
                    longPressTriggered.current = true;
                    runOnJS(handleLongPressComplete)();
                }
            });
        }, SHORT_PRESS_THRESHOLD);
    };

    const handlePressOut = () => {
        const pressDuration = Date.now() - pressStartTime.current;
        
        // Clear the timeout - if released before threshold, animation never starts
        if (animationTimeout.current) {
            clearTimeout(animationTimeout.current);
            animationTimeout.current = null;
        }

        if (isPressed) {
            // Animation WAS showing
            cancelAnimation(progress);
            progress.value = withTiming(0, { duration: 150 });
            setIsPressed(false);
            
            // If released here (after threshold but before completion), DO NOTHING (Reset)
            // This is the "medium press cancels" logic
        } else {
            // Animation NOT showing (Brief press)
            if (pressDuration < SHORT_PRESS_THRESHOLD) {
                onPress();
            }
        }
    };

    const handleLongPressComplete = () => {
        onLongPress();
        setIsPressed(false);
        progress.value = withTiming(0, { duration: 150 });
    };

    const displayText = isPressed 
        ? `Hold for ${longPressLabel}...`
        : shortPressLabel;

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            className={`relative overflow-hidden ${disabled ? 'opacity-50' : ''}`}
            style={style}
        >
            {/* Background gradient with progress */}
            <View className={`relative ${!children ? 'bg-indigo-600 rounded-2xl' : ''}`}>
                
                {/* Content */}
                {children ? (
                    <View className="relative z-10 w-full h-full justify-center items-center">
                        {children}
                    </View>
                ) : (
                    <View className="px-6 py-4 relative z-10">
                        <Text className="text-white text-center text-lg font-semibold">
                            {displayText}
                        </Text>
                    </View>
                )}

                {/* Progress indicator overlay */}
                <Animated.View 
                    style={[
                        animatedStyle, 
                        { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 0 },
                        children ? { backgroundColor: 'rgba(255,255,255,0.3)' } : { backgroundColor: '#6366f1' } // indigo-500
                    ]} 
                />
            </View>
        </Pressable>
    );
}
