import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { islandBaseStyle } from '../ui/IslandBar';
import { useSettingsStore } from '../../store/settings';
import { LinkService, FolderGroup } from '../../services/linkService';
import { LinksFolderView } from '../links/LinksFolderView';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../ui/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LinksScreen() {
    const { vaultUri, linksRoot } = useSettingsStore();
    const insets = useSafeAreaInsets();
    const [folders, setFolders] = useState<FolderGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeFolder, setActiveFolder] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    const loadFolders = useCallback(async () => {
        if (!vaultUri || !linksRoot) {
            setFolders([]);
            setIsLoading(false);
            return;
        }

        try {
            setError(null);
            const groups = await LinkService.getFolderGroups(vaultUri, linksRoot);
            setFolders(groups);

            // Set initial active folder if not set
            if (groups.length > 0) {
                setActiveFolder(prev => {
                    if (!prev || !groups.find(g => g.path === prev)) {
                        return groups[0].path;
                    }
                    return prev;
                });
            }
        } catch (e) {
            console.error('[LinksScreen] Failed to load folders', e);
            setError('Failed to scan links folder');
        } finally {
            setIsLoading(false);
        }
    }, [vaultUri, linksRoot]);

    // Reload when screen is focused or config changes
    useFocusEffect(
        useCallback(() => {
            loadFolders();
        }, [loadFolders, vaultUri, linksRoot])
    );

    const renderEmptyState = () => (
        <Layout>
            <View className="flex-1 justify-center items-center p-8">
                <Ionicons name="link-outline" size={64} color="#475569" />
                <Text className="text-white text-xl font-bold mt-4 text-center">No Link Folders Found</Text>
                <Text className="text-text-tertiary mt-2 text-center">
                    {!linksRoot
                        ? "Please configure your Links Root folder in Settings."
                        : `No sub-folders found in "${linksRoot}". Add folders to your vault to organize links.`}
                </Text>
            </View>
        </Layout>
    );

    if (isLoading && folders.length === 0) {
        return (
            <Layout>
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#818cf8" />
                </View>
            </Layout>
        );
    }

    if (folders.length === 0) {
        return renderEmptyState();
    }

    const activeFolderObj = folders.find(f => f.path === activeFolder) || folders[0];

    return (
        <Layout fullBleed={true}>
            <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
                <IslandHeader
                    title="Links"
                    tabs={folders.map(f => ({ key: f.path, label: f.name }))}
                    activeTab={activeFolder}
                    onTabChange={setActiveFolder}
                    tabsScrollable={true}
                    rightActions={[
                        {
                            icon: 'search',
                            onPress: () => setShowSearch(!showSearch),
                            color: showSearch ? Colors.primary : Colors.text.tertiary
                        }
                    ]}
                    showSearch={showSearch}
                    onCloseSearch={() => setShowSearch(false)}
                    searchBar={{
                        value: searchQuery,
                        onChangeText: setSearchQuery,
                        placeholder: "Search links..."
                    }}
                />
            </View>

            {activeFolderObj && (
                <LinksFolderView
                    folderUri={activeFolderObj.uri}
                    folderPath={activeFolderObj.path}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    listPaddingTop={insets.top + 60}
                />
            )}
        </Layout>
    );
}
