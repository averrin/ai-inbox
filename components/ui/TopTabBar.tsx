import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface TopTab {
    key: string;
    label: string;
    icon?: string;
}

interface TopTabBarProps {
    tabs: TopTab[];
    activeTab: string;
    onTabChange: (key: string) => void;
    /** Enable horizontal scrolling when many tabs */
    scrollable?: boolean;
}

/**
 * Reusable top tab bar styled to match the bottom nav bar's island aesthetic.
 * Dark pill container, active tab highlighted.
 */
export function TopTabBar({ tabs, activeTab, onTabChange, scrollable }: TopTabBarProps) {
    const content = (
        <View
            className="flex-row items-center"
            style={{
                backgroundColor: '#1e293b',
                borderRadius: 24,
                padding: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 4,
            }}
        >
            {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => onTabChange(tab.key)}
                        className="flex-row items-center justify-center"
                        style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: isActive ? '#334155' : 'transparent',
                            marginHorizontal: 1,
                        }}
                    >
                        {tab.icon && (
                            <Ionicons
                                name={tab.icon as any}
                                size={16}
                                color={isActive ? '#3b82f6' : '#94a3b8'}
                                style={{ marginRight: tab.label ? 6 : 0 }}
                            />
                        )}
                        <Text
                            style={{
                                fontSize: 13,
                                fontWeight: '700',
                                color: isActive ? '#ffffff' : '#94a3b8',
                            }}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (scrollable) {
        return (
            <View className="px-4 py-2">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 0 }}
                >
                    {content}
                </ScrollView>
            </View>
        );
    }

    return (
        <View className="px-4 py-2">
            {content}
        </View>
    );
}

/**
 * Adapter: use TopTabBar as a custom tabBar for MaterialTopTabNavigator.
 * Pass this to `tabBar` prop of the navigator.
 */
export function TopTabBarNavigatorAdapter({ state, descriptors, navigation }: any) {
    const tabs: TopTab[] = state.routes.map((route: any) => {
        const { options } = descriptors[route.key];
        return {
            key: route.name,
            label: options.title || route.name,
            icon: options.tabBarIcon,
        };
    });

    return (
        <TopTabBar
            tabs={tabs}
            activeTab={state.routes[state.index].name}
            onTabChange={(key) => {
                const event = navigation.emit({
                    type: 'tabPress',
                    target: state.routes.find((r: any) => r.name === key)?.key,
                    canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                    navigation.navigate(key);
                }
            }}
            scrollable={tabs.length > 3}
        />
    );
}
