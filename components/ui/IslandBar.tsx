import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { Shadows, Colors } from './design-tokens';

export interface IslandBarProps {
    /** Content for the left island */
    leftContent?: React.ReactNode;
    /** Content for the right island */
    rightContent?: React.ReactNode;
    /** Props to apply to the container view */
    containerStyle?: StyleProp<ViewStyle>;
    /** Props to apply to each individual island */
    islandStyle?: StyleProp<ViewStyle>;
}

export const islandBaseStyle: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: Colors.surface, // slate-800
    borderRadius: 30, // match bottom navbar
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    overflow: 'hidden',
    ...Shadows.default,
    opacity: 0.95
};

/**
 * A shared component for rendering separated left and right floating horizontal islands.
 * This is used for both the top headers and the bottom navigation bar.
 */
export function IslandBar({ leftContent, rightContent, containerStyle, islandStyle }: IslandBarProps) {
    return (
        <View style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, containerStyle]} pointerEvents="box-none">
            {leftContent ? (
                <View style={[islandBaseStyle, { flexShrink: 1 }, islandStyle]}>
                    {leftContent}
                </View>
            ) : <View />}
            {rightContent ? (
                <View style={[islandBaseStyle, { flexShrink: 0 }, islandStyle]}>
                    {rightContent}
                </View>
            ) : <View />}
        </View>
    );
}
