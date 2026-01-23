import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

interface BaseListItemProps {
    leftIcon?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    rightActions?: ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    activeOpacity?: number;
}

export function BaseListItem({
    leftIcon,
    title,
    subtitle,
    rightActions,
    onPress,
    onLongPress,
    containerStyle,
    activeOpacity = 0.7
}: BaseListItemProps) {
    const Container = onPress || onLongPress ? TouchableOpacity : View;

    return (
        <Container 
            className="flex-row items-center bg-slate-800/50 p-3 rounded-xl border border-slate-700 mb-2"
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={onPress ? activeOpacity : 1}
            style={containerStyle}
        >
            {/* Left Icon */}
            {leftIcon && (
                <View className="mr-3 items-center justify-center w-10 h-10 bg-slate-700 rounded-lg overflow-hidden">
                    {leftIcon}
                </View>
            )}

            {/* Content */}
            <View className="flex-1 justify-center">
                {typeof title === 'string' ? (
                    <Text className="text-white font-medium text-sm" numberOfLines={1}>{title}</Text>
                ) : (
                    title
                )}
                
                {subtitle && (
                    <View className="mt-0.5">
                        {typeof subtitle === 'string' ? (
                            <Text className="text-slate-400 text-xs" numberOfLines={1}>{subtitle}</Text>
                        ) : (
                            subtitle
                        )}
                    </View>
                )}
            </View>

            {/* Right Actions */}
            {rightActions && (
                <View className="ml-2 flex-row items-center gap-2">
                    {rightActions}
                </View>
            )}
        </Container>
    );
}
