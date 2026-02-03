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
            const isDone = task.status === 'x' || task.status === '-';
            const matchesStatus = isDone === showCompleted;
            const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
            return matchesStatus && matchesSearch;
        });
    }, [tasks, search, showCompleted]);

    const tasksWithGroups = useMemo(() => {
        return filteredTasks.map((task, index) => {
            const isFirstInFile = index === 0 || filteredTasks[index - 1].filePath !== task.filePath;
            const isLastInFile = index === filteredTasks.length - 1 || filteredTasks[index + 1].filePath !== task.filePath;
            const isSingleInFile = isFirstInFile && isLastInFile;
            return { 
                ...task, 
                isFirstInFile, 
                isLastInFile,
                showGuide: !isSingleInFile
            };
        });
    }, [filteredTasks]);

    const handleToggleTask = async (task: TaskWithSource) => {
        const newStatus = task.status === 'x' ? ' ' : 'x';
        const updatedTask: RichTask = { ...task, status: newStatus, completed: newStatus === 'x' };
        
        setTasks(prev => prev.map(t => 
            (t.fileUri === task.fileUri && t.originalLine === task.originalLine) ? { ...t, status: newStatus, completed: newStatus === 'x', originalLine: serializeTaskLine(updatedTask) } : t
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
                (t.fileUri === editingTask.fileUri && t.originalLine === editingTask.originalLine) ? { ...t, ...updatedTask, originalLine: serializeTaskLine(updatedTask) } : t
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

    const handleRemoveCompleted = async () => {
        const completedTasks = tasks.filter(t => t.completed);
        if (completedTasks.length === 0) {
            Toast.show({ type: 'info', text1: 'No completed tasks to remove' });
            return;
        }

        Alert.alert(
            "Clear Completed",
            `Are you sure you want to remove all ${completedTasks.length} completed tasks from their files?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Clear", 
                    style: "destructive",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            // Group by fileUri to avoid reading/writing same file multiple times
                            const byFile = completedTasks.reduce((acc, task) => {
                                if (!acc[task.fileUri]) acc[task.fileUri] = [];
                                acc[task.fileUri].push(task);
                                return acc;
                            }, {} as Record<string, TaskWithSource[]>);

                            for (const [fileUri, tasksInFile] of Object.entries(byFile)) {
                                await TaskService.syncBulkDeletion(vaultUri!, tasksInFile);
                            }

                            setTasks(prev => prev.filter(t => !t.completed));
                            Toast.show({ type: 'success', text1: `Cleared ${completedTasks.length} tasks` });
                        } catch (e) {
                            console.error('[handleRemoveCompleted] Failed', e);
                            Toast.show({ type: 'error', text1: 'Bulk removal failed' });
                        } finally {
                            setIsLoading(false);
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
        <View className="flex-1 bg-transparent">
            <TasksFilterPanel 
                search={search}
                setSearch={setSearch}
                showCompleted={showCompleted}
                setShowCompleted={setShowCompleted}
                onRemoveCompleted={handleRemoveCompleted}
            />

            <FlatList
                data={tasksWithGroups}
                keyExtractor={(item, index) => `${item.filePath}-${index}`}
                renderItem={({ item }) => (
                    <RichTaskItem
                        task={item}
                        onToggle={() => handleToggleTask(item)}
                        onEdit={() => handleEditTask(item)}
                        onDelete={() => handleDeleteTask(item)}
                        fileName={item.fileName}
                        showGuide={item.showGuide}
                        isFirstInFile={item.isFirstInFile}
                        isLastInFile={item.isLastInFile}
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
                    onCancel={() => {
                        setIsModalVisible(false);
                        setEditingTask(null);
                    }}
                    onSave={handleSaveEdit}
                />
            )}
        </View>
    );
}
