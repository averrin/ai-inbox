import React from 'react';
import { View } from 'react-native';
import { vars } from 'nativewind';
import { useSettingsStore } from '../store/settings';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const { theme } = useSettingsStore();

    const themeVars = vars({
        '--color-background': theme.colors.background,
        '--color-surface': theme.colors.surface,
        '--color-surface-highlight': theme.colors.surfaceHighlight,
        '--color-primary': theme.colors.primary,
        '--color-secondary': theme.colors.secondary,
        '--color-text': theme.colors.text,
        '--color-text-secondary': theme.colors.textSecondary,
        '--color-border': theme.colors.border,
        '--color-success': theme.colors.success,
        '--color-error': theme.colors.error,
        '--color-warning': theme.colors.warning,
        '--color-info': theme.colors.info,
    });

    return (
        <View style={[themeVars, { flex: 1 }]}>
            {children}
        </View>
    );
}
