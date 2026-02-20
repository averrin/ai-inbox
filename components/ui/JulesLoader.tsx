import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Gradients, Sizes } from './design-tokens';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface JulesLoaderProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  innerColor?: string;
  children?: React.ReactNode;
}

const SIZE_MAP = Sizes.loader;

const BORDER_WIDTH_MAP = Sizes.loaderBorder;

export function JulesLoader({ size = 'medium', message, innerColor = Colors.surface, children }: JulesLoaderProps) {
  const rotation = useSharedValue(0);
  const sizeValue = SIZE_MAP[size];
  const borderWidth = BORDER_WIDTH_MAP[size];

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1
    );
    return () => cancelAnimation(rotation);
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={styles.container}>
      <View style={{ width: sizeValue, height: sizeValue, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View style={[animatedStyle, { width: sizeValue, height: sizeValue, borderRadius: sizeValue / 2, overflow: 'hidden' }]}>
            <LinearGradient
                colors={[...Gradients.loader] as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: '100%', height: '100%', padding: borderWidth }}
            >
               <View style={{ flex: 1, backgroundColor: innerColor, borderRadius: (sizeValue - borderWidth * 2) / 2 }} />
            </LinearGradient>
        </Animated.View>
        {children && (
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                {children}
            </View>
        )}
      </View>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    marginTop: 12,
    color: Colors.text.tertiary, // slate-400
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
