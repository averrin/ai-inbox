import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Alert } from 'react-native';
import { useTasksStore, TaskWithSource } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { TaskService } from '../../services/taskService';
import { RichTaskItem } from '../markdown/RichTaskItem';
import { TaskEditModal } from '../markdown/TaskEditModal';
import { TasksFilterPanel } from './TasksFilterPanel';
import { RichTask, serializeTaskLine } from '../../utils/taskParser';
import Toast from 'react-native-toast-message';

interface TasksFolderViewProps {
    folderUri: string;
    folderPath: string;
}

export function TasksFolderView({ folderUri, folderPath }: TasksFolderViewProps) {
    const { vaultUri } = useSettingsStore();
    const [tasks, setTasks] = useState<TaskWithSource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Filter State
    const [search, setSearch] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);

    // Edit Modal State
    const [editingTask, setEditingTask] = useState<TaskWithSource | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const loadTasks = useCallback(async (refresh = false) => {
        if (!folderUri) return;
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const result = await TaskService.scanTasksInFolder(folderUri, folderPath);
            setTasks(result);
        } catch (e) {
            console.error('[TasksFolderView] Failed to load tasks', e);
            Toast.show({
                type: 'error',
                text1: 'Load Failed',
                text2: 'Could not read tasks from this folder.'
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [folderUri, folderPath]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchesStatus = task.completed === showCompleted;
            const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [tasks, search, showCompleted]);

    const handleToggleTask = async (task: TaskWithSource) => {
        const updatedTask: RichTask = { ...task, completed: !task.completed };
        
        // Optimistic UI update
        setTasks(prev => prev.map(t => 
            (t.filePath === task.filePath && t.title === task.title) ? { ...t, completed: !t.completed } : t
        ));

        try {
            await TaskService.syncTaskUpdate(vaultUri!, task, updatedTask);
        } catch (e) {
            // Revert on error
            setTasks(prev => prev.map(t => 
                (t.filePath === task.filePath && t.title === task.title) ? { ...t, completed: task.completed } : t
            ));
            Toast.show({
                type: 'error',
                text1: 'Update Failed',
                text2: 'Could not sync change to file.'
            });
        }
    };

    const handleEditTask = (task: TaskWithSource) => {
        setEditingTask(task);
        setIsModalVisible(true);
    };

    const handleSaveEdit = async (updatedTask: RichTask) => {
        if (!editingTask || !vaultUri) return;

        try {
            await TaskService.syncTaskUpdate(vaultUri, editingTask, updatedTask);
            setTasks(prev => prev.map(t => 
                (t.filePath === editingTask.filePath && t.title === editingTask.title) ? { ...t, ...updatedTask } : t
            ));
            setIsModalVisible(false);
            setEditingTask(null);
        } catch (e) {
            Toast.show({
                type: 'error',
                text1: 'Save Failed',
                text2: 'Could not sync edits to file.'
            });
        }
    };

    const handleDeleteTask = async (task: TaskWithSource) => {
        Alert.alert(
            "Delete Task",
            "Are you sure you want to remove this task from its source file?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await TaskService.syncTaskDeletion(vaultUri!, task);
                            setTasks(prev => prev.filter(t => t !== task));
                            Toast.show({ type: 'success', text1: 'Task Removed' });
                        } catch (e) {
                            Toast.show({ type: 'error', text1: 'Delete Failed' });
                        }
                    }
                }
            ]
        );
    };

    if (isLoading && tasks.length === 0) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-950">
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-950">
            <TasksFilterPanel 
                search={search}
                setSearch={setSearch}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
            />

            <FlatList
                data={filteredTasks}
                keyExtractor={(item, index) => `${item.filePath}-${index}`}
                renderItem={({ item }) => (
                    <RichTaskItem
                        task={item}
                        onToggle={() => handleToggleTask(item)}
                        onEdit={() => handleEditTask(item)}
                        onDelete={() => handleDeleteTask(item)}
                        subtitle={`File: ${item.fileName}`}
                    />
                )}
                contentContainerStyle={{ padding: 16 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Text className="text-slate-500 italic">No tasks found matching criteria.</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl 
                        refreshing={isRefreshing} 
                        onRefresh={() => loadTasks(true)} 
                        tintColor="#818cf8"
                    />
                }
            />

            {editingTask && (
                <TaskEditModal
                    visible={isModalVisible}
                    task={editingTask}
                    onClose={() => {
                        setIsModalVisible(false);
                        setEditingTask(null);
                    }}
                    onSave={handleSaveEdit}
                />
            )}
        </View>
    );
}
