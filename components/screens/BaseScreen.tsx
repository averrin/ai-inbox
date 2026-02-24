import React, { ReactNode } from 'react';
import { View, StyleProp, ViewStyle, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';

export interface TabItem {
    key: string;
    label: string;
    icon?: any;
    activeIcon?: any;
}

export interface BaseScreenProps {
    /** Title displayed in the IslandHeader */
    title: string;
    /** Optional tabs to display in the header */
    tabs?: TabItem[];
    /** The currently active tab key */
    activeTab?: string;
    /** Callback when a tab is pressed or swiped to */
    onTabChange?: (tab: string) => void;
    /** Right side actions for the header */
    rightActions?: { icon: string; onPress: () => void; color?: string; badge?: number | boolean }[];
    /** Custom nodes to render inside the IslandHeader below the main title */
    headerChildren?: ReactNode;
    /** The main content of the screen. Supports passing a render function to receive layout context. */
    children: ReactNode | ((props: { insets: any, headerHeight: number }) => ReactNode);
    /** Style applied to the content wrapper view */
    style?: StyleProp<ViewStyle>;
    /** Disable attaching swipe tab gesture handlers */
    disableSwipe?: boolean;
}

/**
 * BaseScreen provides a standardized layout shell for main screens.
 * It offers a positioned IslandHeader and optional drag/swipe navigation between tabs.
 */
export function BaseScreen({
    title,
    tabs,
    activeTab,
    onTabChange,
    rightActions = [],
    headerChildren,
    children,
    style,
    disableSwipe = false,
}: BaseScreenProps) {
    const insets = useSafeAreaInsets();
    
    // We pass empty array config if tabs aren't provided to satisfy hooks rules
    const hookTabs = tabs ? tabs.map(t => t.key) : [];
    const { panHandlers } = useSwipeTabs({
        tabs: hookTabs,
        activeTab: activeTab || '',
        onTabChange: onTabChange || (() => {}),
    });
    
    const swipeProps = (tabs && !disableSwipe) ? panHandlers : {};
    
    const headerHeight = 60;

    return (
        <Layout>
            <View style={[{ flex: 1 }, style]} {...swipeProps}>
                <View style={{ position: 'absolute', top: 4, left: 0, right: 0, zIndex: 1000 }}>
                    <IslandHeader
                        title={title}
                        rightActions={rightActions}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                    >
                        {headerChildren}
                    </IslandHeader>
                </View>

                {typeof children === 'function' 
                    ? children({ insets, headerHeight }) 
                    : children
                }
            </View>
        </Layout>
    );
}

export interface BaseScrollViewProps extends BaseScreenProps {
    /** Additional styles applied to the internal ScrollView contents */
    contentContainerStyle?: StyleProp<ViewStyle>;
    /** Disable the default horizontal padding (16px) */
    disableHorizontalPadding?: boolean;
}

/**
 * Convenience wrapper over BaseScreen that automatically implements a ScrollView
 * with consistent margins and paddings out of the box.
 */
export function BaseScrollView({ 
    contentContainerStyle, 
    disableHorizontalPadding = false,
    ...props 
}: BaseScrollViewProps) {
    return (
        <BaseScreen {...props}>
            {({ insets, headerHeight }) => (
                <ScrollView
                    contentContainerStyle={[
                        { 
                            paddingTop: headerHeight, 
                            paddingBottom: insets.bottom + 100, 
                            paddingHorizontal: disableHorizontalPadding ? 0 : 16 
                        },
                        contentContainerStyle
                    ]}
                >
                    {/* For BaseScrollView, we assume children is ReactNode, not a function */}
                    {props.children as ReactNode}
                </ScrollView>
            )}
        </BaseScreen>
    );
}
