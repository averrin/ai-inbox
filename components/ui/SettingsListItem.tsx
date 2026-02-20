import React, { ReactNode } from 'react';
import { View, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';

interface SettingsListItemProps {
    children: ReactNode;
    onPress?: () => void;
    color?: string; // Optional color indicator strip
    style?: StyleProp<ViewStyle>;
}

export function SettingsListItem({ children, onPress, color, style }: SettingsListItemProps) {
    const Container = onPress ? TouchableOpacity : View;

    return (
        <Container
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
            className="bg-surface rounded-lg p-3 mb-2 flex-row items-center border border-border"
            style={style}
        >
            {color && (
                <View
                    className="w-1.5 h-10 rounded-full mr-3"
                    style={{ backgroundColor: color }}
                />
            )}
            {children}
        </Container>
    );
}
