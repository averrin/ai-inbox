import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shadows } from './design-tokens';

export interface HeaderAction {
    icon: string;
    onPress: () => void;
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

// Mimic the bottom navbar island style
const islandContainerStyle: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 30, // match bottom navbar
    padding: 2,       // reduced padding for slimmer look (was 4)
    alignItems: 'center',
    ...Shadows.default,
    opacity: 0.95
};

export function IslandHeader({
    title,
    subtitle,
    leftContent,
    rightContent,
    rightActions,
    children,
    noMargin = false,
}: IslandHeaderProps) {
    return (
        <View className={`${noMargin ? '' : 'mb-4'} pt-2 px-2`}>
            {/* Top Row: Left and Right Islands */}
            <View className="flex-row justify-between items-start mb-4">

                {/* Left Island */}
                <View style={islandContainerStyle}>
                    {leftContent ? (
                        leftContent
                    ) : (
                        <View className="flex-col justify-center px-3 py-1.5">
                            <Text className="text-white font-bold text-lg leading-tight" numberOfLines={1}>
                                {title}
                            </Text>
                            {subtitle && (
                                <Text className="text-slate-400 text-xs font-medium" numberOfLines={1}>
                                    {subtitle}
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* Right Island */}
                {(rightContent || (rightActions && rightActions.length > 0)) && (
                    <View style={islandContainerStyle}>
                        {rightContent ? (
                            rightContent
                        ) : (
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
                                                color={action.color || '#94a3b8'}
                                            />
                                        </TouchableOpacity>
                                    )
                                )}
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Bottom Content (e.g. New Session Button) */}
            {children}
        </View>
    );
}
