import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows, Colors } from './design-tokens';
import { IslandBar } from './IslandBar';

export interface HeaderAction {
    icon?: string;
    onPress?: () => void;
    color?: string;
    disabled?: boolean;
    /** Render a custom element instead of an icon button */
    render?: () => React.ReactNode;
}

interface IslandHeaderProps {
    title: string;
    subtitle?: string;
    /** Override left island content */
    leftContent?: React.ReactNode;
    /** Override right island content */
    rightContent?: React.ReactNode;
    /** Array of right-side action buttons */
    rightActions?: HeaderAction[];
    /** Content rendered below the title row (e.g. New Session Button) */
    children?: React.ReactNode;
    /** Hide bottom margin */
    noMargin?: boolean;
}

export function IslandHeader({
    title,
    subtitle,
    leftContent,
    rightContent,
    rightActions,
    children,
    noMargin = false,
}: IslandHeaderProps) {

    const renderLeft = () => {
        if (leftContent) return leftContent;
        return (
            <View className="flex-col justify-center px-4 py-1.5">
                <Text className="text-white font-bold text-lg leading-tight" numberOfLines={1}>
                    {title}
                </Text>
                {subtitle && (
                    <Text className="text-slate-400 text-xs font-medium" numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
        );
    };

    const renderRight = () => {
        if (rightContent) return rightContent;
        if (rightActions && rightActions.length > 0) {
            return (
                <View className="flex-row items-center">
                    {rightActions?.map((action, index) =>
                        action.render ? (
                            <React.Fragment key={index}>
                                {action.render()}
                            </React.Fragment>
                        ) : (
                            <TouchableOpacity
                                key={index}
                                onPress={action.onPress}
                                disabled={action.disabled}
                                style={{
                                    width: 44,
                                    height: 44,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    opacity: action.disabled ? 0.4 : 1,
                                    marginHorizontal: 2
                                }}
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
            );
        }
        return null; // neither rightContent nor rightActions
    };

    return (
        <View className={`${noMargin ? '' : 'mb-2'} pt-2`}>
            {/* Top Row: Left and Right Islands */}
            <IslandBar 
                leftContent={renderLeft()}
                rightContent={renderRight()}
                containerStyle={{ paddingHorizontal: 8 }}
            />
            
            {/* Bottom Content (e.g. New Session Button) */}
            {children}
        </View>
    );
}
