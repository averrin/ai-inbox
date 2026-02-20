import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';

interface ActionButtonProps {
    onPress: () => void;
    icon: keyof typeof Ionicons.glyphMap;
    variant?: 'neutral' | 'danger' | 'success' | 'warning';
    size?: number;
}

export function ActionButton({ onPress, icon, variant = 'neutral', size = 16 }: ActionButtonProps) {
    const getStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    container: 'bg-surface-highlight',
                    color: '#f87171'
                };
            case 'success':
                return {
                    container: 'bg-surface-highlight',
                    color: '#4ade80'
                };
            case 'warning':
                return {
                    container: 'bg-surface-highlight', // Matching the recurrence tag style roughly or generic warning
                    color: '#fbbf24'
                };
            default: // neutral
                return {
                    container: 'bg-surface-highlight/50',
                    color: Colors.text.tertiary
                };
        }
    };

    const styles = getStyles();

    return (
        <TouchableOpacity 
            onPress={onPress} 
            className={`p-2 rounded-lg ${styles.container}`}
        >
            <Ionicons name={icon} size={size} color={styles.color} />
        </TouchableOpacity>
    );
}
