import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from './design-tokens';
import { IslandBar } from './IslandBar';
import { TopTabBar, TopTab } from './TopTabBar';

export interface HeaderAction {
    icon?: string;
    onPress?: () => void;
    color?: string;
    disabled?: boolean;
    /** Render a custom element instead of an icon button */
    render?: () => React.ReactNode;
}

export interface SearchBarConfig {
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    onSubmit?: () => void;
}

interface IslandHeaderProps {
    title: string;
    subtitle?: string;
    /** Override left island content entirely (mutually exclusive with tabs) */
    leftContent?: React.ReactNode;
    /** Override right island content entirely */
    rightContent?: React.ReactNode;
    /** Array of right-side action buttons */
    rightActions?: HeaderAction[];
    /** Content rendered below the title row (e.g. filter chips) */
    children?: React.ReactNode;
    /** Hide bottom margin */
    noMargin?: boolean;

    // ── Unified tab support ──────────────────────────────────────────
    /** Tab definitions – rendered inside the left island next to the title */
    tabs?: TopTab[];
    /** Currently active tab key */
    activeTab?: string;
    /** Tab change callback */
    onTabChange?: (key: string) => void;
    /**
     * Whether the tabs should scroll horizontally.
     * Defaults to true when there are more than 3 tabs.
     */
    tabsScrollable?: boolean;

    // ── Unified Search Bar support ───────────────────────────────────
    /** Configuration for the search bar */
    searchBar?: SearchBarConfig;
    /** Whether the search bar is currently visible */
    showSearch?: boolean;
    /** Callback to close the search bar */
    onCloseSearch?: () => void;
}

export function IslandHeader({
    title,
    subtitle,
    leftContent,
    rightContent,
    rightActions,
    children,
    noMargin = false,
    tabs,
    activeTab,
    onTabChange,
    tabsScrollable,
    searchBar,
    showSearch,
    onCloseSearch,
}: IslandHeaderProps) {

    const hasTabs = tabs && tabs.length > 0 && activeTab !== undefined && onTabChange;
    const scrollable = tabsScrollable ?? (tabs ? tabs.length > 3 : false);

    const renderLeft = () => {
        if (showSearch && searchBar) {
            return (
                <View className="flex-row items-center px-4 py-1.5" style={{ minWidth: 100, flex: 1 }}>
                    <Ionicons name="search-outline" size={18} color={Colors.secondary} />
                    <TextInput
                        className="flex-1 ml-2 text-white font-medium text-sm"
                        style={{ height: 28, padding: 0 }}
                        placeholder={searchBar.placeholder || "Search..."}
                        placeholderTextColor={Colors.secondary}
                        value={searchBar.value}
                        onChangeText={searchBar.onChangeText}
                        onSubmitEditing={searchBar.onSubmit}
                        returnKeyType="search"
                        autoFocus
                    />
                    {searchBar.value.length > 0 && (
                        <TouchableOpacity onPress={() => searchBar.onChangeText('')} style={{ padding: 4 }}>
                            <Ionicons name="close-circle" size={18} color={Colors.secondary} />
                        </TouchableOpacity>
                    )}
                </View>
            );
        }

        // If caller supplies raw leftContent, use it directly (backwards compat)
        if (leftContent) {
            return (
                <View className="flex-row items-center" style={{ maxWidth: '80%', minWidth: 100 }}>
                    {leftContent}
                </View>
            );
        }

        return (
            <View className="flex-row items-center" style={{ minWidth: 100, overflow: 'hidden' }}>
                {/* Title (+ optional subtitle) */}
                <View className="flex-col px-4 py-1.5" style={{ flexShrink: 0 }}>
                    <Text className="text-white font-bold text-lg leading-tight" numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle ? (
                        <Text className="text-text-tertiary text-xs font-medium" numberOfLines={1}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>

                {/* Inline tabs */}
                {hasTabs && (
                    <TopTabBar
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={onTabChange}
                        scrollable={scrollable}
                        variant="flat"
                    />
                )}
            </View>
        );
    };

    const renderRight = () => {
        if (showSearch && onCloseSearch) {
            return (
                <TouchableOpacity
                    onPress={() => {
                        if (searchBar) searchBar.onChangeText(''); // Clear search on close
                        onCloseSearch();
                    }}
                    style={{
                        width: 44,
                        height: 44,
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginHorizontal: 2,
                    }}
                >
                    <Ionicons name="close" size={22} color={Colors.text.tertiary} />
                </TouchableOpacity>
            );
        }

        if (rightContent) return rightContent;
        if (rightActions && rightActions.length > 0) {
            return (
                <View className="flex-row items-center">
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
                                style={{
                                    width: 44,
                                    height: 44,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    opacity: action.disabled ? 0.4 : 1,
                                    marginHorizontal: 2,
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
        return null;
    };

    return (
        <View className={`${noMargin ? '' : 'mb-2'} pt-2`}>
            {/* Top Row: Left and Right Islands */}
            <IslandBar
                leftContent={renderLeft()}
                rightContent={renderRight()}
                containerStyle={{ paddingHorizontal: 8 }}
            />

            {/* Bottom Content (e.g. filter chips) */}
            {children}
        </View>
    );
}
