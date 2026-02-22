import React from 'react';
import { GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import { AppButton } from './AppButton';

/**
 * Legacy ActionButton -- delegates to AppButton.
 * Preserved for backward compatibility; prefer AppButton directly in new code.
 */

interface ActionButtonProps {
    onPress: (event?: GestureResponderEvent) => void;
    icon: keyof typeof Ionicons.glyphMap;
    variant?: 'neutral' | 'danger' | 'success' | 'warning';
    size?: number;
}

const VARIANT_COLOR: Record<string, string> = {
    danger: '#f87171',
    success: '#4ade80',
    warning: '#fbbf24',
    neutral: Colors.text.tertiary,
};

export function ActionButton({ onPress, icon, variant = 'neutral', size = 16 }: ActionButtonProps) {
    return (
        <AppButton
            icon={icon as string}
            variant="secondary"
            size="sm"
            rounding="md"
            color={VARIANT_COLOR[variant]}
            onPress={onPress}
            style={variant === 'neutral' ? { opacity: 0.5 } : undefined}
        />
    );
}
