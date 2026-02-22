import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import { LinearGradient } from 'expo-linear-gradient';

export interface TopTab {
    key: string;
    label: string;
    icon?: string;
    /** Optional icon to show when tab is active (e.g. filled variant) */
    activeIcon?: string;
    /** Optional custom color when active (defaults to Colors.white) */
    activeColor?: string;
}

interface TopTabBarProps {
    tabs: TopTab[];
    activeTab: string;
    onTabChange: (key: string) => void;
    /** Enable horizontal scrolling when many tabs */
    scrollable?: boolean;
    /** 'pill' wraps tabs in a dark island container; 'flat' renders inline without background */
    variant?: 'pill' | 'flat';
    /**
     * Gradient fade color for scrollable edges.
     * Defaults to the surface color (rgba(30, 41, 59, 1)).
     * Set to match the parent container background.
     */
    fadeColor?: string;
}

const SURFACE_OPAQUE = 'rgba(30, 41, 59, 1)';
const SURFACE_TRANSPARENT = 'rgba(30, 41, 59, 0)';

/**
 * Unified top tab bar component.
 *
 * - `pill` variant: standalone dark island container with shadow (for use outside IslandHeader)
 * - `flat` variant: no background, meant to sit inside an IslandHeader left island
 *
 * When `scrollable` is true, wraps in a horizontal ScrollView with gradient fade overlays.
 */
export function TopTabBar({
    tabs,
    activeTab,
    onTabChange,
    scrollable = false,
    variant = 'pill',
    fadeColor,
}: TopTabBarProps) {
    const scrollRef = useRef<ScrollView>(null);
    const [scrollX, setScrollX] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const isFlat = variant === 'flat';

    const fadeOpaque = fadeColor || SURFACE_OPAQUE;
    const fadeTransparent = fadeColor
        ? fadeColor.replace(/[\d.]+\)$/, '0)')
        : SURFACE_TRANSPARENT;

    const canScrollRight = contentWidth > containerWidth && scrollX < contentWidth - containerWidth - 10;

    const handleScroll = useCallback((e: any) => {
        setScrollX(e.nativeEvent.contentOffset.x);
    }, []);

    const handleContainerLayout = useCallback((e: LayoutChangeEvent) => {
        setContainerWidth(e.nativeEvent.layout.width);
    }, []);

    const handleContentSizeChange = useCallback((w: number) => {
        setContentWidth(w);
    }, []);

    const renderTabs = () => (
        <View
            className="flex-row items-center"
            style={isFlat ? {} : {
                backgroundColor: Colors.surface,
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
                const iconName = isActive && tab.activeIcon ? tab.activeIcon : tab.icon;
                const iconColor = isActive
                    ? (tab.activeColor || Colors.primary)
                    : Colors.text.tertiary;

                return (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => onTabChange(tab.key)}
                        className="flex-row items-center justify-center"
                        style={isFlat ? {
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                            marginRight: 4,
                            borderRadius: 20,
                            backgroundColor: isActive ? Colors.surfaceHighlight : Colors.transparent,
                        } : {
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 20,
                            backgroundColor: isActive ? Colors.surfaceHighlight : Colors.transparent,
                            marginHorizontal: 1,
                        }}
                    >
                        {iconName && (
                            <Ionicons
                                name={iconName as any}
                                size={16}
                                color={iconColor}
                                style={{ marginRight: tab.label ? 6 : 0 }}
                            />
                        )}
                        {tab.label ? (
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: '700',
                                    color: isActive ? Colors.white : Colors.text.tertiary,
                                }}
                                numberOfLines={1}
                            >
                                {tab.label}
                            </Text>
                        ) : null}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    if (scrollable) {
        return (
            <View
                className={isFlat ? '' : 'py-2'}
                style={{ position: 'relative', flexShrink: 1, minWidth: 0 }}
                onLayout={handleContainerLayout}
            >
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    onContentSizeChange={handleContentSizeChange}
                    contentContainerStyle={{
                        flexGrow: 0,
                        paddingHorizontal: isFlat ? 0 : 16,
                        paddingRight: isFlat ? 24 : 16,
                    }}
                >
                    {renderTabs()}
                </ScrollView>

                {/* Left fade */}
                {scrollX > 10 && (
                    <LinearGradient
                        colors={[fadeOpaque, fadeTransparent] as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 24,
                            borderTopLeftRadius: isFlat ? 0 : 30,
                            borderBottomLeftRadius: isFlat ? 0 : 30,
                        }}
                        pointerEvents="none"
                    />
                )}

                {/* Right fade */}
                {canScrollRight && (
                    <LinearGradient
                        colors={[fadeTransparent, fadeOpaque] as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: isFlat ? 16 : 32,
                            borderTopRightRadius: isFlat ? 0 : 30,
                            borderBottomRightRadius: isFlat ? 0 : 30,
                        }}
                        pointerEvents="none"
                    />
                )}
            </View>
        );
    }

    return (
        <View className={isFlat ? '' : 'px-4 py-2'}>
            {renderTabs()}
        </View>
    );
}

/**
 * Adapter: use TopTabBar as a custom tabBar for MaterialTopTabNavigator.
 * Pass this to the `tabBar` prop of the navigator.
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
