import { useEffect } from 'react';
import { useUIStore } from '../store/ui';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';

export function useFab({
    onPress,
    icon = 'add',
    visible = true,
    color
}: {
    onPress: () => void;
    icon?: string;
    visible?: boolean;
    color?: string;
}) {
    const { setFab, clearFab } = useUIStore();

    useFocusEffect(
        React.useCallback(() => {
            if (visible) {
                setFab({ onPress, icon, visible: true, color });
            } else {
                clearFab();
            }

            return () => {
                // Clear on blur/unmount
                clearFab();
            };
        }, [onPress, icon, visible, color, setFab, clearFab])
    );
}
