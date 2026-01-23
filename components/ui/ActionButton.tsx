import React from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
                    container: 'bg-red-900/20',
                    color: '#f87171'
                };
            case 'success':
                return {
                    container: 'bg-green-900/20',
                    color: '#4ade80'
                };
            case 'warning':
                return {
                    container: 'bg-indigo-900/50', // Matching the recurrence tag style roughly or generic warning
                    color: '#fbbf24'
                };
            default: // neutral
                return {
                    container: 'bg-slate-700/50',
                    color: '#94a3b8'
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
