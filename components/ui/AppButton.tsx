import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleProp, ViewStyle, TextStyle, GestureResponderEvent } from 'react-native';
import { Colors } from './design-tokens';
import { UniversalIcon } from './UniversalIcon';

// ---------------------------------------------------------------------------
// Variant / Size / Rounding tokens
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'success' | 'warning';
type Size = 'xs' | 'sm' | 'md' | 'lg';
type Rounding = 'none' | 'sm' | 'md' | 'lg' | 'full';

const ROUNDING: Record<Rounding, number> = {
    none: 2,
    sm: 6,
    md: 8,
    lg: 12,
    full: 999,
};

function getVariantStyles(variant: Variant, selected?: boolean) {
    // When "selected" is true we always use the primary palette regardless
    // of the original variant.  This covers all toggle/segment patterns.
    if (selected) {
        return {
            bg: Colors.primary,
            border: Colors.primary,
            text: '#FFFFFF',
            iconColor: '#FFFFFF',
        };
    }

    switch (variant) {
        case 'primary':
            return {
                bg: Colors.primary,
                border: Colors.primary,
                text: '#FFFFFF',
                iconColor: '#FFFFFF',
            };
        case 'secondary':
            return {
                bg: Colors.surfaceHighlight,
                border: Colors.border,
                text: Colors.text.primary,
                iconColor: Colors.text.tertiary,
            };
        case 'ghost':
            return {
                bg: Colors.surface,
                border: Colors.border,
                text: Colors.text.primary,
                iconColor: Colors.text.tertiary,
            };
        case 'danger':
            return {
                bg: `${Colors.error}cc`, // ~80% opacity
                border: Colors.error,
                text: '#FFFFFF',
                iconColor: '#FFFFFF',
            };
        case 'danger-outline':
            return {
                bg: Colors.surface,
                border: Colors.error,
                text: Colors.error,
                iconColor: Colors.error,
            };
        case 'success':
            return {
                bg: Colors.success,
                border: Colors.success,
                text: '#FFFFFF',
                iconColor: '#FFFFFF',
            };
        case 'warning':
            return {
                bg: Colors.warning,
                border: Colors.warning,
                text: '#FFFFFF',
                iconColor: '#FFFFFF',
            };
    }
}

interface SizeDimensions {
    paddingH: number;
    paddingV: number;
    fontSize: number;
    fontWeight: TextStyle['fontWeight'];
    iconSize: number;
    iconGap: number;
    borderWidth: number;
}

function getSizeStyles(size: Size): SizeDimensions {
    switch (size) {
        case 'xs':
            return { paddingH: 8, paddingV: 4, fontSize: 10, fontWeight: '700', iconSize: 12, iconGap: 4, borderWidth: 1 };
        case 'sm':
            return { paddingH: 12, paddingV: 8, fontSize: 13, fontWeight: '600', iconSize: 16, iconGap: 6, borderWidth: 1 };
        case 'md':
            return { paddingH: 16, paddingV: 12, fontSize: 15, fontWeight: '600', iconSize: 20, iconGap: 8, borderWidth: 1 };
        case 'lg':
            return { paddingH: 16, paddingV: 16, fontSize: 18, fontWeight: '700', iconSize: 20, iconGap: 8, borderWidth: 1 };
    }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppButtonProps {
    // --- Content ---
    title?: string;
    icon?: string;               // UniversalIcon name (Ionicons or mc/*)
    iconPosition?: 'left' | 'right';
    children?: React.ReactNode;  // For fully custom content

    // --- Appearance ---
    variant?: Variant;
    size?: Size;
    rounding?: Rounding;
    selected?: boolean;          // Toggle/segment selected state
    color?: string;              // Override icon color (for icon-only or special cases)

    // --- Behaviour ---
    onPress?: (event?: GestureResponderEvent) => void;
    disabled?: boolean;
    loading?: boolean;
    flex?: boolean;              // flex-1 (for button rows)

    // --- Escape hatches ---
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppButton({
    title,
    icon,
    iconPosition = 'left',
    children,
    variant = 'primary',
    size = 'md',
    rounding = 'lg',
    selected,
    color,
    onPress,
    disabled = false,
    loading = false,
    flex = false,
    style,
    textStyle,
    hitSlop,
}: AppButtonProps) {
    const v = getVariantStyles(variant, selected);
    const s = getSizeStyles(size);
    const radius = ROUNDING[rounding];

    const isDisabled = disabled || loading;
    const iconOnly = !!icon && !title && !children;

    // For icon-only buttons use square-ish padding
    const paddingH = iconOnly ? s.paddingV : s.paddingH;
    const paddingV = s.paddingV;

    const resolvedIconColor = color ?? v.iconColor;

    const containerStyle: ViewStyle = {
        backgroundColor: v.bg,
        borderColor: v.border,
        borderWidth: s.borderWidth,
        borderRadius: radius,
        paddingHorizontal: paddingH,
        paddingVertical: paddingV,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isDisabled ? 0.5 : 1,
        ...(flex ? { flex: 1 } : {}),
    };

    const labelStyle: TextStyle = {
        color: v.text,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
    };

    const renderIcon = (name: string, side: 'left' | 'right') => (
        <View style={title ? (side === 'left' ? { marginRight: s.iconGap } : { marginLeft: s.iconGap }) : undefined}>
            <UniversalIcon name={name} size={s.iconSize} color={resolvedIconColor} />
        </View>
    );

    return (
        <TouchableOpacity
            onPress={isDisabled ? undefined : onPress}
            disabled={isDisabled}
            activeOpacity={0.7}
            style={[containerStyle, style]}
            hitSlop={hitSlop}
        >
            {loading ? (
                <ActivityIndicator size="small" color={v.text} />
            ) : children ? (
                children
            ) : (
                <>
                    {icon && iconPosition === 'left' && renderIcon(icon, 'left')}
                    {title ? <Text style={[labelStyle, textStyle]}>{title}</Text> : null}
                    {icon && iconPosition === 'right' && renderIcon(icon, 'right')}
                </>
            )}
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// Convenience presets
// ---------------------------------------------------------------------------

/** Icon-only close button (for modal headers). */
export function CloseButton({ onPress, size = 'sm', style }: { onPress: () => void; size?: Size; style?: StyleProp<ViewStyle> }) {
    return (
        <AppButton
            icon="close"
            variant="ghost"
            size={size}
            rounding="full"
            onPress={onPress}
            style={style}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
    );
}
