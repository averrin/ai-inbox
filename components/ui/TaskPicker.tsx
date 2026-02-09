import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Ionicons } from '@expo/vector-icons';
import { NavigationIndependentTree, NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useSettingsStore } from '../../store/settings';
import { useTasksStore, TaskWithSource } from '../../store/tasks';
import { TaskService, FolderGroup } from '../../services/taskService';
import { useFolderTasks } from '../../hooks/useFolderTasks';
import { useFilteredTasks } from '../../hooks/useFilteredTasks';
import { TasksList } from '../tasks/TasksList';
import { TasksFilterPanel } from '../tasks/TasksFilterPanel';
import { SelectionSheet, SelectionOption } from './SelectionSheet';

const TopTab = createMaterialTopTabNavigator();

// Transparent Theme for NavigationContainer to respect Modal background
const TransparentTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
  },
};

interface TaskPickerTabProps {
    folder: FolderGroup;
    selectionMode: boolean;
    selectedIds: string[];
    onToggleSelection: (task: TaskWithSource) => void;
    filterState: {
        search: string;
        showCompleted: boolean;
        sortBy: 'smart' | 'file' | 'title' | 'priority';
    };
}

function TaskPickerTab({ folder, selectionMode, selectedIds, onToggleSelection, filterState }: TaskPickerTabProps) {
    const { tasks, isLoading, isRefreshing, loadTasks } = useFolderTasks(folder.uri, folder.path);

    const filteredTasks = useFilteredTasks(tasks, filterState.search, filterState.showCompleted, filterState.sortBy);

    return (
        <TasksList
            tasks={filteredTasks}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={() => loadTasks(true)}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelection={onToggleSelection}
            // No CRUD actions needed for picker
        />
    );
}

interface TaskPickerProps {
    visible: boolean;
    initialSelectedIds?: string[]; // IDs of tasks that should be selected initially
    initialSelectedTasks?: TaskWithSource[]; // Task objects that should be selected initially (if available)
    onSelect: (selectedTasks: TaskWithSource[]) => void;
    onCancel: () => void;
}

export function TaskPicker({ visible, initialSelectedIds = [], initialSelectedTasks = [], onSelect, onCancel }: TaskPickerProps) {
    const { vaultUri } = useSettingsStore();
    const { tasksRoot } = useTasksStore();
    const [folders, setFolders] = useState<FolderGroup[]>([]);
    const [isLoadingFolders, setIsLoadingFolders] = useState(true);

    // Selection State
    // We map ID -> TaskWithSource
    const [selectedTasksMap, setSelectedTasksMap] = useState<Record<string, TaskWithSource>>({});

    // Filter State (Global for all tabs in picker)
    const [search, setSearch] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    const [sortBy, setSortBy] = useState<'smart' | 'file' | 'title' | 'priority'>('smart');
    const [isSortSheetVisible, setIsSortSheetVisible] = useState(false);

    const SORT_OPTIONS: SelectionOption[] = [
        { id: 'smart', label: 'Smart Sort (Status + Priority)', icon: 'flash-outline', color: '#818cf8' },
        { id: 'file', label: 'File Order', icon: 'document-text-outline', color: '#94a3b8' },
        { id: 'title', label: 'Alphabetical (Title)', icon: 'text-outline', color: '#94a3b8' },
        { id: 'priority', label: 'Priority Only', icon: 'flag-outline', color: '#ef4444' },
    ];

    // Initialize selection map
    useEffect(() => {
        if (visible) {
            const initialMap: Record<string, TaskWithSource> = {};

            // Populate from initialSelectedTasks
            initialSelectedTasks.forEach(task => {
                const id = task.fileUri + task.originalLine;
                initialMap[id] = task;
            });

            // Note: initialSelectedIds are not enough to populate TaskWithSource if we don't have the objects.
            // We assume caller passes TaskWithSource if they want them to be returned.
            // If we only have IDs, we might miss them in the final selection if the user doesn't visit the tab.
            // But we can store IDs in a separate set if needed.
            // For now, assume initialSelectedTasks is what we rely on for "Done" return value.

            setSelectedTasksMap(initialMap);
            loadFolders();
        }
    }, [visible, initialSelectedTasks]); // Depend on visible to reset/init

    const loadFolders = useCallback(async () => {
        if (!vaultUri || !tasksRoot) {
            setFolders([]);
            setIsLoadingFolders(false);
            return;
        }
        try {
            const groups = await TaskService.getFolderGroups(vaultUri, tasksRoot);
            setFolders(groups);
        } catch (e) {
            console.error('[TaskPicker] Failed to load folders', e);
        } finally {
            setIsLoadingFolders(false);
        }
    }, [vaultUri, tasksRoot]);

    const handleToggleSelection = useCallback((task: TaskWithSource) => {
        const id = task.fileUri + task.originalLine;
        setSelectedTasksMap(prev => {
            const newMap = { ...prev };
            if (newMap[id]) {
                delete newMap[id];
            } else {
                newMap[id] = task;
            }
            return newMap;
        });
    }, []);

    const handleDone = () => {
        onSelect(Object.values(selectedTasksMap));
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
            <View className="flex-1 bg-slate-950">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                    <TouchableOpacity onPress={onCancel}>
                        <Text className="text-slate-400 text-lg">Cancel</Text>
                    </TouchableOpacity>
                    <Text className="text-white text-lg font-bold">Select Tasks</Text>
                    <TouchableOpacity onPress={handleDone}>
                        <Text className="text-indigo-400 text-lg font-bold">Done</Text>
                    </TouchableOpacity>
                </View>

                {/* Filter Panel */}
                <View className="bg-slate-900 pb-2">
                     <TasksFilterPanel
                        search={search}
                        setSearch={setSearch}
                        showCompleted={showCompleted}
                        setShowCompleted={setShowCompleted}
                        sortBy={sortBy}
                        onToggleSort={() => setIsSortSheetVisible(true)}
                        // Hide unrelated actions
                        onRemoveCompleted={() => {}}
                        onMergeTasks={() => {}}
                    />
                </View>

                {/* Content */}
                {isLoadingFolders ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#818cf8" />
                    </View>
                ) : (
                    <NavigationIndependentTree>
                        <NavigationContainer theme={TransparentTheme}>
                            <TopTab.Navigator
                                screenOptions={{
                                    tabBarStyle: {
                                        backgroundColor: '#0f172a',
                                        borderBottomColor: '#334155',
                                        borderBottomWidth: 1,
                                    },
                                    tabBarIndicatorStyle: {
                                        backgroundColor: '#818cf8',
                                    },
                                    tabBarLabelStyle: {
                                        textTransform: 'none',
                                        fontWeight: '600',
                                        fontSize: 12,
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
                                    >
                                        {() => (
                                            <TaskPickerTab
                                                folder={folder}
                                                selectionMode={true}
                                                selectedIds={Object.keys(selectedTasksMap)}
                                                onToggleSelection={handleToggleSelection}
                                                filterState={{ search, showCompleted, sortBy }}
                                            />
                                        )}
                                    </TopTab.Screen>
                                ))}
                            </TopTab.Navigator>
                        </NavigationContainer>
                    </NavigationIndependentTree>
                )}
            </View>

            {/* Sort Picker Sheet */}
            <SelectionSheet
                visible={isSortSheetVisible}
                title="Sort Tasks By"
                options={SORT_OPTIONS}
                onSelect={(option) => setSortBy(option.id as any)}
                onClose={() => setIsSortSheetVisible(false)}
            />
        </Modal>
    );
}
