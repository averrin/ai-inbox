import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import { IslandHeader } from './IslandHeader';
import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';

interface IslandHeaderTabBarProps extends MaterialTopTabBarProps {
    title: string;
}

export function IslandHeaderTabBar({ state, descriptors, navigation, title }: IslandHeaderTabBarProps) {
    const tabs = state.routes.map((route) => {
        const { options } = descriptors[route.key];
        return {
            key: route.key,
            name: route.name,
            label: options.title || route.name,
            icon: options.tabBarIcon,
        };
    });

    const activeIndex = state.index;

    const TabContent = (
        <View className="flex-row items-center pl-2 pr-1">
            <Text className="text-white font-bold text-lg leading-tight mr-3">
                {title}
            </Text>
            <View className="flex-1" style={{ maxWidth: 220 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingRight: 4 }}
                >
                    <View className="flex-row items-center bg-surface/50 rounded-full p-0.5">
                        {tabs.map((tab, index) => {
                            const isActive = index === activeIndex;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    onPress={() => {
                                        const event = navigation.emit({
                                            type: 'tabPress',
                                            target: tab.key,
                                            canPreventDefault: true,
                                        });

                                        if (!event.defaultPrevented) {
                                            navigation.navigate(tab.name);
                                        }
                                    }}
                                    className={`flex-row items-center px-3 py-1.5 rounded-full ${isActive ? 'bg-surface-highlight' : 'bg-transparent'}`}
                                >
                                    {tab.icon && (
                                        typeof tab.icon === 'function'
                                            ? tab.icon({ focused: isActive, color: isActive ? "white" : Colors.text.tertiary, size: 16 })
                                            : <Ionicons
                                                name={tab.icon as any}
                                                size={16}
                                                color={isActive ? "white" : Colors.text.tertiary}
                                                style={{ marginRight: tab.label ? 6 : 0 }}
                                              />
                                    )}
                                    <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-text-tertiary'}`}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </View>
    );

    return (
        <IslandHeader
            title={title}
            leftContent={TabContent}
            noMargin
        />
    );
}
