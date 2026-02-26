import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { AppButton, AppButtonProps } from './AppButton';

/**
 * Legacy Button component -- delegates to AppButton.
 * Preserved for backward compatibility; prefer AppButton directly in new code.
 */

interface ButtonProps {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'danger';
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    textStyle?: string | StyleProp<TextStyle>;
    style?: StyleProp<ViewStyle>;
}

const VARIANT_MAP: Record<string, AppButtonProps['variant']> = {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
};

export function Button({ onPress, title, variant = 'primary', loading = false, disabled = false, textStyle, style, className }: ButtonProps) {
    // Note: className prop is handled by NativeWind babel plugin which converts it to style prop
    // However, if we receive it explicitly we should probably pass it or its resulting style.
    // For now, we assume NativeWind handles the call site.

    return (
        <AppButton
            title={title}
            variant={VARIANT_MAP[variant]}
            size="lg"
            onPress={onPress}
            loading={loading}
            disabled={disabled}
            textStyle={textStyle as any} // Cast to any to avoid complex type matching if AppButton expects object
            style={style}
        />
    );
}
