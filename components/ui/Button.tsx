import React from 'react';
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
}

const VARIANT_MAP: Record<string, AppButtonProps['variant']> = {
    primary: 'primary',
    secondary: 'secondary',
    danger: 'danger',
};

export function Button({ onPress, title, variant = 'primary', loading = false, disabled = false }: ButtonProps) {
    return (
        <AppButton
            title={title}
            variant={VARIANT_MAP[variant]}
            size="lg"
            onPress={onPress}
            loading={loading}
            disabled={disabled}
        />
    );
}
