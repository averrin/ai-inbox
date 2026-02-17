import { useEffect } from 'react';
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
    const { setFab, clearFab } = useUIStore();

    useFocusEffect(
        React.useCallback(() => {
            if (visible) {
                setFab({ onPress, icon, visible: true, color, onLongPress, iconColor });
            } else {
                clearFab();
            }

            return () => {
                // Clear on blur/unmount
                clearFab();
            };
        }, [onPress, icon, visible, color, onLongPress, iconColor, setFab, clearFab])
    );
}
