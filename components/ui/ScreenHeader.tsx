import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';

export interface HeaderAction {
    icon: string;
    onPress: () => void;
    color?: string;
    disabled?: boolean;
    /** Render a custom element instead of an icon button */
    render?: () => React.ReactNode;
}

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    /** Back / left action icon name (e.g. "arrow-back") */
    leftIcon?: string;
    onLeftPress?: () => void;
    /** Array of right-side action buttons */
    rightActions?: HeaderAction[];
    /** Extra content rendered below the title row (e.g. filter chips) */
    children?: React.ReactNode;
    /** Hide bottom border */
    noBorder?: boolean;
}

export function ScreenHeader({
    title,
    subtitle,
    leftIcon,
    onLeftPress,
    rightActions,
    children,
    noBorder = false,
}: ScreenHeaderProps) {
    return (
        <View
            className={`px-4 pt-3 pb-2 ${noBorder ? '' : 'border-b border-slate-800'}`}
            style={{ backgroundColor: Colors.transparent }}
        >
            <View className="flex-row items-center justify-between">
                {/* Left side: optional back + title */}
                <View className="flex-row items-center flex-1 mr-2">
                    {leftIcon && onLeftPress && (
                        <TouchableOpacity onPress={onLeftPress} className="p-1 mr-2">
                            <Ionicons name={leftIcon as any} size={24} color="white" />
                        </TouchableOpacity>
                    )}
                    <View className="flex-1">
                        <Text className="text-2xl font-bold text-white" numberOfLines={1}>
                            {title}
                        </Text>
                        {subtitle ? (
                            <Text className="text-slate-500 text-xs font-medium" numberOfLines={1}>
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>
                </View>

                {/* Right side: action buttons */}
                {rightActions && rightActions.length > 0 && (
                    <View className="flex-row items-center gap-1">
                        {rightActions.map((action, index) =>
                            action.render ? (
                                <React.Fragment key={index}>
                                    {action.render()}
                                </React.Fragment>
                            ) : (
                                <TouchableOpacity
                                    key={index}
                                    onPress={action.onPress}
                                    disabled={action.disabled}
                                    className="p-2"
                                    style={action.disabled ? { opacity: 0.4 } : undefined}
                                >
                                    <Ionicons
                                        name={action.icon as any}
                                        size={22}
                                        color={action.color || Colors.text.tertiary}
                                    />
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                )}
            </View>

            {children}
        </View>
    );
}
