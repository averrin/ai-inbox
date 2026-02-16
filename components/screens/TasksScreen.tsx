import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { ScreenHeader } from '../ui/ScreenHeader';
import { TopTabBarNavigatorAdapter } from '../ui/TopTabBar';
import { useTasksStore } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { TaskService, FolderGroup } from '../../services/taskService';
import { useVaultStore } from '../../services/vaultService';
import { TasksFolderView } from '../tasks/TasksFolderView';
import { useFocusEffect } from '@react-navigation/native';

const TopTab = createMaterialTopTabNavigator();

export default function TasksScreen() {
    const { vaultUri } = useSettingsStore();
    const { tasksRoot } = useTasksStore();
    const [folders, setFolders] = useState<FolderGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFolders = useCallback(async () => {
        if (!vaultUri || !tasksRoot) {
            setFolders([]);
            setIsLoading(false);
            return;
        }

        try {
            setError(null);
            const groups = await TaskService.getFolderGroups(vaultUri, tasksRoot);
            setFolders(groups);
        } catch (e) {
            console.error('[TasksScreen] Failed to load folders', e);
            setError('Failed to scan tasks folder');
        } finally {
            setIsLoading(false);
        }
    }, [vaultUri, tasksRoot]);

    // Reload when screen is focused or config changes
    useFocusEffect(
        useCallback(() => {
            loadFolders();
            // Trigger vault structure refresh limited to tasksRoot for efficient property suggestions
            if (vaultUri && tasksRoot) {
                useVaultStore.getState().refreshStructure(vaultUri, tasksRoot);
            }
        }, [loadFolders, vaultUri, tasksRoot])
    );

    const renderEmptyState = () => (
        <Layout>
            <View className="flex-1 justify-center items-center p-8">
                <Ionicons name="list-outline" size={64} color="#475569" />
                <Text className="text-white text-xl font-bold mt-4 text-center">No Task Folders Found</Text>
                <Text className="text-slate-400 mt-2 text-center">
                    {!tasksRoot 
                        ? "Please configure your Tasks Root folder in Settings." 
                        : `No sub-folders found in "${tasksRoot}". Add folders to your vault to organize tasks.`}
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
            <ScreenHeader title="Tasks" noBorder />
            <View className="flex-1 bg-transparent">
                <TopTab.Navigator
                    style={{ backgroundColor: 'transparent' }}
                    // @ts-ignore
                    sceneContainerStyle={{ backgroundColor: 'transparent' }}
                    tabBar={(props) => <TopTabBarNavigatorAdapter {...props} />}
                    screenOptions={{
                        swipeEnabled: true,
                        animationEnabled: true,
                    }}
                >
                    {folders.map((folder) => (
                        <TopTab.Screen 
                            key={folder.path}
                            name={folder.name}
                            options={{ title: folder.name }}
                        >
                            {() => (
                                <TasksFolderView 
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
