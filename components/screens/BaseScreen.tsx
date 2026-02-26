import React, { ReactNode, useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleProp, ViewStyle, ScrollView, Animated, Dimensions, Easing, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Layout } from '../ui/Layout';
import { IslandHeader, HeaderAction, SearchBarConfig } from '../ui/IslandHeader';
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
    /** Optional subtitle displayed in the IslandHeader */
    subtitle?: string;
    /** Optional tabs to display in the header */
    tabs?: TabItem[];
    /** The currently active tab key */
    activeTab?: string;
    /** Callback when a tab is pressed or swiped to */
    onTabChange?: (tab: string) => void;
    /** Right side actions for the header */
    rightActions?: HeaderAction[];
    /** Custom nodes to render inside the IslandHeader below the main title */
    headerChildren?: ReactNode;
    /** Configuration for the search bar */
    searchBar?: SearchBarConfig;
    /** Whether the search bar is currently visible */
    showSearch?: boolean;
    /** Callback to close the search bar */
    onCloseSearch?: () => void;
    /** The main content of the screen. Supports passing a render function to receive layout context. */
    children: ReactNode | ((props: { insets: any, headerHeight: number }) => ReactNode);
    /** Style applied to the content wrapper view */
    style?: StyleProp<ViewStyle>;
    /** Disable attaching swipe tab gesture handlers */
    disableSwipe?: boolean;
    /** Enable full bleed layout (no padding in SafeAreaView) */
    fullBleed?: boolean;
    /** Disable default padding in Layout */
    noPadding?: boolean;
    /** Whether to show a back button in the header */
    showBackButton?: boolean;
    /** Custom callback for back button press. If not provided, navigation.goBack() is used */
    onBack?: () => void;
    /** When rendered inside another screen that already has a SafeAreaView, set to true to avoid double insets */
    embedded?: boolean;
}

interface TabTransitionProps {
    children: ReactNode;
    activeTab: string;
    tabs: TabItem[];
    style?: StyleProp<ViewStyle>;
}

function TabTransition({ children, activeTab, tabs, style }: TabTransitionProps) {
    const [displayTab, setDisplayTab] = useState(activeTab);
    const [renderedChildren, setRenderedChildren] = useState(children);
    const [previousChildren, setPreviousChildren] = useState<ReactNode | null>(null);
    const [direction, setDirection] = useState(0); // 1 = right-to-left (next), -1 = left-to-right (prev)

    const progress = useRef(new Animated.Value(0)).current;
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (activeTab !== displayTab) {
            const oldIndex = tabs.findIndex(t => t.key === displayTab);
            const newIndex = tabs.findIndex(t => t.key === activeTab);
            // If tab not found, default to forward
            const dir = (newIndex >= 0 && oldIndex >= 0)
                ? (newIndex > oldIndex ? 1 : -1)
                : 1;

            setPreviousChildren(renderedChildren);
            setRenderedChildren(children);
            setDisplayTab(activeTab);
            setDirection(dir);

            progress.setValue(0);
            Animated.timing(progress, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
                easing: Easing.out(Easing.ease),
            }).start(() => {
                setPreviousChildren(null);
            });
        } else {
             // Just update content if tab hasn't changed (e.g. loading -> data)
             setRenderedChildren(children);
        }
    }, [activeTab, children, tabs, displayTab]); // Added displayTab to deps to be safe

    const screenWidth = Dimensions.get('window').width;

    const enterTranslateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [direction * screenWidth, 0]
    });

    const exitTranslateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -direction * screenWidth]
    });

    return (
        <View style={[style, { overflow: 'hidden', flex: 1 }]}>
            {previousChildren && (
                <Animated.View
                    style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        transform: [{ translateX: exitTranslateX }],
                        zIndex: 1
                    }}
                    pointerEvents="none" // Disable interaction on leaving view
                >
                    {previousChildren}
                </Animated.View>
            )}
            <Animated.View style={{
                flex: 1,
                transform: [{ translateX: previousChildren ? enterTranslateX : 0 }],
                zIndex: 2
            }}>
                {renderedChildren}
            </Animated.View>
        </View>
    );
}

/**
 * BaseScreen provides a standardized layout shell for main screens.
 * It offers a positioned IslandHeader and optional drag/swipe navigation between tabs.
 */
export function BaseScreen({
    title,
    subtitle,
    tabs,
    activeTab,
    onTabChange,
    rightActions = [],
    headerChildren,
    searchBar,
    showSearch,
    onCloseSearch,
    children,
    style,
    disableSwipe = false,
    fullBleed = false,
    noPadding = false,
    showBackButton = false,
    onBack,
    embedded,
}: BaseScreenProps) {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    // Auto-detect embedded if not explicitly set: when onBack is provided the
    // component is rendered inside another screen that already has SafeAreaView.
    const isEmbedded = embedded ?? (onBack !== undefined);
    const [headerHeight, setHeaderHeight] = useState(56);
    
    // We pass empty array config if tabs aren't provided to satisfy hooks rules
    const hookTabs = tabs ? tabs.map(t => t.key) : [];
    const { panHandlers } = useSwipeTabs({
        tabs: hookTabs,
        activeTab: activeTab || '',
        onTabChange: onTabChange || (() => {}),
    });
    
    const swipeProps = (tabs && !disableSwipe) ? panHandlers : {};

    const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) setHeaderHeight(h);
    }, []);

    // Resolve children content
    const content = typeof children === 'function'
        ? children({ insets, headerHeight })
        : children;

    return (
        <Layout fullBleed={fullBleed} noPadding={isEmbedded || noPadding} edges={isEmbedded ? [] : ['top', 'left', 'right']}>
            <View style={[{ flex: 1 }, style]} {...swipeProps}>
                <View style={{ position: 'absolute', top: 4, left: isEmbedded ? 16 : 0, right: isEmbedded ? 16 : 0, zIndex: 1000 }} onLayout={onHeaderLayout}>
                    <IslandHeader
                        title={title}
                        subtitle={subtitle}
                        rightActions={rightActions}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        searchBar={searchBar}
                        showSearch={showSearch}
                        onCloseSearch={onCloseSearch}
                        showBackButton={showBackButton}
                        onBack={onBack || (() => navigation.goBack())}
                    >
                        {headerChildren}
                    </IslandHeader>
                </View>

                {tabs && activeTab ? (
                    <TabTransition
                        activeTab={activeTab}
                        tabs={tabs}
                        style={{ flex: 1 }}
                    >
                        {content}
                    </TabTransition>
                ) : (
                    content
                )}
            </View>
        </Layout>
    );
}

export interface BaseScrollViewProps extends BaseScreenProps {
    /** Additional styles applied to the internal ScrollView contents */
    contentContainerStyle?: StyleProp<ViewStyle>;
    /** Disable the default horizontal padding (16px) */
    disableHorizontalPadding?: boolean;
    /** Extra padding added on top of the header height. Defaults to 20. */
    extraTopPadding?: number;
}

/**
 * Convenience wrapper over BaseScreen that automatically implements a ScrollView
 * with consistent margins and paddings out of the box.
 */
export function BaseScrollView({ 
    contentContainerStyle, 
    disableHorizontalPadding = true,
    extraTopPadding = 10,
    ...props 
}: BaseScrollViewProps) {
    return (
        <BaseScreen {...props}>
            {({ insets, headerHeight }) => (
                <ScrollView
                    contentContainerStyle={[
                        { 
                            paddingTop: headerHeight + extraTopPadding, 
                            paddingBottom: insets.bottom + 60, 
                            paddingHorizontal: disableHorizontalPadding ? 16 : 16,
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
