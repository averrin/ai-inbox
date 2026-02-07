import React, { useState, useEffect, useRef } from 'react';
import { View, LayoutChangeEvent, ViewStyle, StyleProp, PanResponder, PanResponderInstance } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientSliderProps {
    colors: string[];
    value: number; // 0 to 1
    onChange: (value: number) => void;
    style?: StyleProp<ViewStyle>;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    step?: number;
}

export function GradientSlider({
    colors,
    value,
    onChange,
    style,
    start = { x: 0, y: 0 },
    end = { x: 1, y: 0 },
    step = 0.01
}: GradientSliderProps) {
    const [width, setWidth] = useState(0);
    const x = useSharedValue(0);
    const widthRef = useRef(0);
    const onChangeRef = useRef(onChange);

    // Sync width ref
    useEffect(() => {
        widthRef.current = width;
    }, [width]);

    // Sync onChange ref
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    // Sync value from props only if not currently dragging? 
    // Usually bidirectional sync is fine as long as parent updates value.
    useEffect(() => {
        if (width > 0) {
            x.value = value * width;
        }
    }, [value, width]);

    const handleLayout = (e: LayoutChangeEvent) => {
        setWidth(e.nativeEvent.layout.width);
    };

    const startX = useRef(0);
    const startValue = useRef(0);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: () => true,

            onPanResponderGrant: (evt, gestureState) => {
                if (widthRef.current === 0) return;

                // Store initial touch position (pageX covers absolute screen position)
                startX.current = evt.nativeEvent.pageX;
                startValue.current = x.value / widthRef.current;

                // Optional: Allow tapping to jump
                // If the user TAPS (dy/dx is small), we might want to jump.
                // But generally, for smoothness, we just start dragging from where the thumb IS?
                // Or if we want "jump to touch", we might need layout measurement.

                // Hybrid approach:
                // 1. If we tap on the bar, we want to jump.
                // 2. If we drag the thumb, we want smooth delta.

                // Since our previous implementation used locationX, let's stick to that for the INITIAL jump
                // then use dx for smooth dragging.

                const { locationX } = evt.nativeEvent;
                const newValue = Math.max(0, Math.min(1, locationX / widthRef.current));
                x.value = newValue * widthRef.current;
                onChangeRef.current(newValue);

                // Reset start value for move phase to be the NEW value
                startValue.current = newValue;
            },

            onPanResponderMove: (evt, gestureState) => {
                if (widthRef.current === 0) return;

                // Use dx from the gesture start to calculate new position relative to startValue
                // This avoids "jumping" if the touch shifts targets or coordinate systems
                const deltaX = gestureState.dx;
                const deltaValue = deltaX / widthRef.current;

                let newValue = startValue.current + deltaValue;
                newValue = Math.max(0, Math.min(1, newValue));

                x.value = newValue * widthRef.current;
                onChangeRef.current(newValue);
            },
        })
    ).current;


    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: x.value - 12 }], // Center the thumb (width 24/2 = 12)
        };
    });

    return (
        <View
            onLayout={handleLayout}
            style={[{ height: 30, justifyContent: 'center' }, style]}
            {...panResponder.panHandlers}
        >
            <LinearGradient
                colors={colors as any}
                start={start}
                end={end}
                style={{ height: 12, borderRadius: 6, width: '100%' }}
            />
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        left: 0,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: 'white',
                        borderWidth: 2,
                        borderColor: 'rgba(0,0,0,0.1)',
                        shadowColor: "#000",
                        shadowOffset: {
                            width: 0,
                            height: 2,
                        },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5,
                    },
                    animatedStyle,
                ]}
                pointerEvents="none"
            />
        </View>
    );
}
