import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { useSettingsStore } from '../../store/settings';
import { LinkService, FolderGroup } from '../../services/linkService';
import { LinksFolderView } from '../links/LinksFolderView';
import { useFocusEffect } from '@react-navigation/native';

const TopTab = createMaterialTopTabNavigator();

export default function LinksScreen() {
    const { vaultUri, linksRoot } = useSettingsStore();
    const [folders, setFolders] = useState<FolderGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
                <Text className="text-slate-400 mt-2 text-center">
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

    return (
        <Layout fullBleed={true}>
            <View className="flex-1 bg-transparent">
                <TopTab.Navigator
                    style={{ backgroundColor: 'transparent' }}
                    // @ts-ignore
                    sceneContainerStyle={{ backgroundColor: 'transparent' }}
                    screenOptions={{
                        tabBarStyle: {
                            backgroundColor: '#0f172a',
                            elevation: 0,
                            shadowOpacity: 0,
                            borderBottomWidth: 1,
                            borderBottomColor: '#1e293b',
                        },
                        tabBarIndicatorStyle: {
                            backgroundColor: '#818cf8',
                            height: 3,
                        },
                        tabBarLabelStyle: {
                            fontSize: 12,
                            fontWeight: 'bold',
                            textTransform: 'none',
                        },
                        tabBarActiveTintColor: '#fff',
                        tabBarInactiveTintColor: '#64748b',
                        tabBarScrollEnabled: folders.length > 3,
                    }}
                >
                    {folders.map((folder) => (
                        <TopTab.Screen
                            key={folder.path}
                            name={folder.name}
                            options={{ title: folder.name }}
                        >
                            {() => (
                                <LinksFolderView
                                    folderUri={folder.uri}
                                    folderPath={folder.path}
                                />
                            )}
                        </TopTab.Screen>
                    ))}
                </TopTab.Navigator>
            </View>
        </Layout>
    );
}
