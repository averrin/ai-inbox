import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { islandBaseStyle } from '../ui/IslandBar';
import { AppButton } from '../ui/AppButton';
import { useTasksStore } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { TaskService, FolderGroup } from '../../services/taskService';
import { useVaultStore } from '../../services/vaultService';
import { TasksFolderView } from '../tasks/TasksFolderView';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../ui/design-tokens';
import { showError } from '../../utils/alert';

export default function TasksScreen() {
    const { vaultUri } = useSettingsStore();
    const { tasksRoot } = useTasksStore();
    const insets = useSafeAreaInsets();
    const [folders, setFolders] = useState<FolderGroup[]>([]);
    const [activeFolder, setActiveFolder] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state (lifted from TasksFolderView for header embedding)
    const [search, setSearch] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    const [sortBy, setSortBy] = useState<'smart' | 'file' | 'title' | 'priority'>('smart');
    const [showFilters, setShowFilters] = useState(true);

    // Reset filters when switching folders
    const handleFolderChange = useCallback((folder: string) => {
        setActiveFolder(folder);
        setSearch('');
    }, []);

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
            if (groups.length > 0 && !groups.find(f => f.name === activeFolder)) {
                setActiveFolder(groups[0].name);
            }
        } catch (e) {
            console.error('[TasksScreen] Failed to load folders', e);
            setError('Failed to scan tasks folder');
        } finally {
            setIsLoading(false);
        }
    }, [vaultUri, tasksRoot, activeFolder]);

    useFocusEffect(
        useCallback(() => {
            loadFolders();
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
                <Text className="text-text-tertiary mt-2 text-center">
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

    const activeFolderObj = folders.find(f => f.name === activeFolder) || folders[0];

    return (
        <Layout fullBleed={true}>
            <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
                <IslandHeader
                    title="Tasks"
                    tabs={folders.map(f => ({ key: f.name, label: f.name }))}
                    activeTab={activeFolder}
                    onTabChange={handleFolderChange}
                    tabsScrollable={folders.length > 3}
                    rightActions={[
                        {
                            icon: showFilters ? 'options' : 'options-outline',
                            onPress: () => setShowFilters(!showFilters),
                            color: showFilters ? Colors.primary : Colors.text.tertiary,
                        },
                    ]}
                    showSearch={showFilters}
                    onCloseSearch={() => setShowFilters(false)}
                    searchBar={{
                        value: search,
                        onChangeText: setSearch,
                        placeholder: "Search tasks..."
                    }}
                >
                    {showFilters && (
                        <View style={[islandBaseStyle, { marginTop: 8, marginLeft: 4, marginRight: 4, flexDirection: 'column', alignItems: 'stretch' }]}>
                            {/* Filter buttons row */}
                            <View className="flex-row items-center justify-between p-2 flex-1 w-full">
                                <View className="flex-row gap-2">
                                    <AppButton
                                        title="Pending"
                                        variant="ghost"
                                        size="sm"
                                        rounding="md"
                                        selected={!showCompleted}
                                        onPress={() => setShowCompleted(false)}
                                    />
                                    <AppButton
                                        title="Completed"
                                        variant="ghost"
                                        size="sm"
                                        rounding="md"
                                        selected={showCompleted}
                                        onPress={() => setShowCompleted(true)}
                                    />
                                    <AppButton
                                        icon="swap-vertical"
                                        title={sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                                        variant="ghost"
                                        size="xs"
                                        rounding="md"
                                        onPress={() => {
                                            const order: typeof sortBy[] = ['smart', 'file', 'title', 'priority'];
                                            const idx = order.indexOf(sortBy);
                                            setSortBy(order[(idx + 1) % order.length]);
                                        }}
                                        color="#818cf8"
                                        textStyle={{ textTransform: 'uppercase', letterSpacing: -0.5 }}
                                    />
                                </View>
                                <AppButton
                                    icon="book-outline"
                                    variant="ghost"
                                    size="sm"
                                    rounding="md"
                                    color="#818cf8"
                                    onPress={() => {
                                        Linking.openURL('obsidian://open').catch(() => {
                                            showError('Error', 'Obsidian app not found or could not be opened.');
                                        });
                                    }}
                                />
                            </View>
                        </View>
                    )}
                </IslandHeader>
            </View>
            <View className="flex-1 bg-transparent">
                {activeFolderObj && (
                    <TasksFolderView
                        folderUri={activeFolderObj.uri}
                        folderPath={activeFolderObj.path}
                        search={search}
                        setSearch={setSearch}
                        showCompleted={showCompleted}
                        setShowCompleted={setShowCompleted}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        hideFilterPanel={true}
                        listPaddingTop={insets.top + (showFilters ? 100 : 50)}
                    />
                )}
            </View>
        </Layout>
    );
}
