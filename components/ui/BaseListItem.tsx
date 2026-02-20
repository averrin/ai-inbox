import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

interface BaseListItemProps {
    leftIcon?: ReactNode;
    selectionComponent?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    rightActions?: ReactNode;
    onPress?: () => void;
    onLongPress?: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    activeOpacity?: number;
    hideIconBackground?: boolean;
}

export function BaseListItem({
    leftIcon,
    selectionComponent,
    title,
    subtitle,
    rightActions,
    onPress,
    onLongPress,
    containerStyle,
    activeOpacity = 0.7,
    hideIconBackground = false
}: BaseListItemProps) {
    const Container = onPress || onLongPress ? TouchableOpacity : View;

    return (
        <Container 
            className="flex-row items-center bg-surface/50 p-3 rounded-xl border border-border mb-2"
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={onPress ? activeOpacity : 1}
            style={containerStyle}
        >
            {/* Selection Component */}
            {selectionComponent && (
                <View className="mr-3 justify-center items-center">
                    {selectionComponent}
                </View>
            )}

            {/* Left Icon - Hidden in selection mode to avoid redundancy */}
            {leftIcon && !selectionComponent && (
                <View className={`${hideIconBackground ? 'mr-3' : 'mr-3 items-center justify-center w-10 h-10 bg-surface-highlight rounded-lg overflow-hidden'}`}>
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
                            <Text className="text-text-tertiary text-xs" numberOfLines={1}>{subtitle}</Text>
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
