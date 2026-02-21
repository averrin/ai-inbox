import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import { UniversalIcon } from './UniversalIcon';

export interface MetadataChipProps {
    label: string | React.ReactNode;
    color?: string; // Hex color
    onPress?: () => void;
    onRemove?: () => void;
    variant?: 'default' | 'outline' | 'solid'; // default = subtle
    rounding?: 'none' | 'sm' | 'md' | 'lg' | 'full';
    icon?: string;
    size?: 'sm' | 'md'; // sm = 10px text (RichTaskItem), md = 12-14px text (Editor)
    style?: StyleProp<ViewStyle>;
}

export function MetadataChip({
    label,
    color,
    onPress,
    onRemove,
    variant = 'default',
    rounding = 'sm',
    icon,
    size = 'sm',
    style
}: MetadataChipProps) {
    const isSolid = variant === 'solid';
    const isOutline = variant === 'outline';

    // Base styles
    const baseColor = color || Colors.primary;

    // Background
    let backgroundColor = 'transparent';
    if (isSolid) {
        backgroundColor = baseColor;
    } else if (isOutline) {
        backgroundColor = 'transparent';
    } else {
        // Default / Subtle (tinted)
        // If color provided, tint it. If not, use generic surface highlight
        backgroundColor = color ? `${baseColor}26` : Colors.surfaceHighlight; // ~15% opacity for tinted
    }

    // Border
    let borderColor = 'transparent';
    if (isSolid) {
        borderColor = baseColor;
    } else if (isOutline) {
         borderColor = baseColor;
    } else {
        // Default subtle might have a very light border or none
        borderColor = color ? `${baseColor}4D` : Colors.border; // ~30% opacity
    }

    // Text Color
    let textColor = Colors.text.primary;
    if (isSolid) {
        textColor = '#FFFFFF';
    } else if (isOutline) {
        textColor = baseColor;
    } else {
        // Default / Subtle
        textColor = color ? baseColor : Colors.text.secondary;
    }

    // Size specific
    const paddingHorizontal = size === 'sm' ? 8 : 12;
    const paddingVertical = size === 'sm' ? 4 : 8;
    const fontSize = size === 'sm' ? 10 : 13;

    // Rounding
    let borderRadius = 6;
    if (rounding === 'none') borderRadius = 2;
    if (rounding === 'sm') borderRadius = 6;
    if (rounding === 'md') borderRadius = 8;
    if (rounding === 'lg') borderRadius = 12;
    if (rounding === 'full') borderRadius = 999;

    const iconSize = size === 'sm' ? 12 : 16;
    const displayIconSize = size === 'sm' ? 10 : 14;

    const Container = onPress ? TouchableOpacity : View;

    // Determine border width
    const borderWidth = (isOutline || isSolid || color) ? 1 : 1;

    return (
        <Container
            onPress={onPress}
            // @ts-ignore
            style={[{
                backgroundColor,
                borderColor,
                borderWidth,
                borderRadius,
                paddingHorizontal,
                paddingVertical,
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'flex-start',
            }, style]}
            hitSlop={onPress ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
        >
            {icon && (
                <View style={{ marginRight: 4 }}>
                    <UniversalIcon
                        name={icon}
                        size={displayIconSize}
                        color={textColor}
                    />
                </View>
            )}
            {typeof label === 'string' ? (
                <Text style={{
                    color: textColor,
                    fontSize,
                    fontWeight: '700', // Making text slightly bolder for better readability on chips
                    marginRight: onRemove ? 4 : 0,
                    letterSpacing: 0.5
                }}>
                    {label}
                </Text>
            ) : (
                <View style={{ marginRight: onRemove ? 4 : 0, flexDirection: 'row', alignItems: 'center' }}>
                    {label}
                </View>
            )}

            {onRemove && (
                <TouchableOpacity
                    onPress={onRemove}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons
                        name="close"
                        size={iconSize}
                        color={isSolid ? 'rgba(255,255,255,0.7)' : (color || Colors.text.tertiary)}
                    />
                </TouchableOpacity>
            )}
        </Container>
    );
}
