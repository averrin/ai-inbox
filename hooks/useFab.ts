import { useEffect, useRef } from 'react';
import { useUIStore } from '../store/ui';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';

export function useFab({
    onPress,
    icon = 'add',
    visible = true,
    color,
    onLongPress,
    iconColor
}: {
    onPress: () => void;
    icon?: string;
    visible?: boolean;
    color?: string;
    onLongPress?: () => void;
    iconColor?: string;
}) {
    const setFab = useUIStore(s => s.setFab);
    const clearFab = useUIStore(s => s.clearFab);

    // Generate a unique ID for this hook instance to manage ownership
    const idRef = useRef<string | null>(null);
    if (!idRef.current) {
        idRef.current = Math.random().toString(36).substr(2, 9);
    }
    const id = idRef.current;

    useFocusEffect(
        React.useCallback(() => {
            if (visible) {
                setFab({ onPress, icon, visible: true, color, onLongPress, iconColor, id });
            } else {
                clearFab(id);
            }

            return () => {
                // Clear on blur/unmount
                clearFab(id);
            };
        }, [onPress, icon, visible, color, onLongPress, iconColor, setFab, clearFab, id])
    );
}
