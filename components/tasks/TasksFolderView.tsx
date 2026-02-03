import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, FlatList, ActivityIndicator, Text, RefreshControl, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { useTasksStore, TaskWithSource } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { TaskService, FolderGroup } from '../../services/taskService';
import { useVaultStore } from '../../services/vaultService';
import { RichTaskItem } from '../markdown/RichTaskItem';
import { TaskEditModal } from '../markdown/TaskEditModal';
import { TasksFilterPanel } from './TasksFilterPanel';
import { RichTask, serializeTaskLine } from '../../utils/taskParser';
import Toast from 'react-native-toast-message';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { SelectionSheet, SelectionOption } from '../ui/SelectionSheet';

interface TasksFolderViewProps {
    folderUri: string;
    folderPath: string;
}

export function TasksFolderView({ folderUri, folderPath }: TasksFolderViewProps) {
    const { vaultUri } = useSettingsStore();
    const { tasksRoot } = useTasksStore();
    const [tasks, setTasks] = useState<TaskWithSource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Filter State
    const [search, setSearch] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);

    // Edit Modal State
    const [editingTask, setEditingTask] = useState<TaskWithSource | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Merge Modal State
    const [isMergeModalVisible, setIsMergeModalVisible] = useState(false);
    const [mergeFileName, setMergeFileName] = useState('');
    const [mergeScope, setMergeScope] = useState<'all' | 'filtered'>('all');

    // Selection Sheet State
    const [activeTaskForSheet, setActiveTaskForSheet] = useState<TaskWithSource | null>(null);
    const [isStatusSheetVisible, setIsStatusSheetVisible] = useState(false);
    const [isPrioritySheetVisible, setIsPrioritySheetVisible] = useState(false);
    const [isSortSheetVisible, setIsSortSheetVisible] = useState(false);
    
    // Sort State
    const [sortBy, setSortBy] = useState<'smart' | 'file' | 'title' | 'priority'>('smart');

    const STATUS_OPTIONS: SelectionOption[] = [
        { id: ' ', label: 'Pending', icon: 'square-outline', color: '#94a3b8' },
        { id: '/', label: 'In Progress', icon: 'play-circle-outline', color: '#818cf8' },
        { id: 'x', label: 'Done', icon: 'checkbox', color: '#22c55e' },
        { id: '-', label: "Won't Do", icon: 'close-circle-outline', color: '#94a3b8' },
        { id: '?', label: 'Planned', icon: 'help-circle-outline', color: '#fbbf24' },
        { id: '>', label: 'Delayed', icon: 'arrow-forward-circle-outline', color: '#6366f1' },
    ];

    const PRIORITY_OPTIONS: SelectionOption[] = [
        { id: 'high', label: 'High Priority', icon: 'arrow-up-circle', color: '#ef4444' },
        { id: 'medium', label: 'Medium Priority', icon: 'remove-circle', color: '#f59e0b' },
        { id: 'low', label: 'Low Priority', icon: 'arrow-down-circle', color: '#22c55e' },
        { id: 'clear', label: 'Clear Priority', icon: 'close-circle', destructive: true },
    ];

    const SORT_OPTIONS: SelectionOption[] = [
        { id: 'smart', label: 'Smart Sort (Status + Priority)', icon: 'flash-outline', color: '#818cf8' },
        { id: 'file', label: 'File Order', icon: 'document-text-outline', color: '#94a3b8' },
        { id: 'title', label: 'Alphabetical (Title)', icon: 'text-outline', color: '#94a3b8' },
        { id: 'priority', label: 'Priority Only', icon: 'flag-outline', color: '#ef4444' },
    ];

    const loadTasks = useCallback(async (refresh = false) => {
        if (!folderUri) return;
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            // Also refresh vault structure to get latest property suggestions
            if (vaultUri && tasksRoot) {
                console.log('[TasksFolderView] Triggering vault structure refresh with context:', tasksRoot);
                useVaultStore.getState().refreshStructure(vaultUri, tasksRoot);
            }
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
        let result = tasks.filter(task => {
            const isDone = task.status === 'x' || task.status === '-';
            const matchesStatus = isDone === showCompleted;
            const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
            return matchesStatus && matchesSearch;
        });

        if (sortBy === 'file') return result;

        const priorityMap: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const statusOrder: Record<string, number> = { ' ': 0, '/': 0, '>': 1, '?': 1, 'x': 2, '-': 2 };

        return [...result].sort((a, b) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title);
            if (sortBy === 'priority') {
                const pA = priorityMap[a.properties.priority] ?? 0;
                const pB = priorityMap[b.properties.priority] ?? 0;
                if (pA !== pB) return pB - pA;
                return a.title.localeCompare(b.title);
            }

            // Default Smart Sort
            const sA = statusOrder[a.status] ?? 3;
            const sB = statusOrder[b.status] ?? 3;
            if (sA !== sB) return sA - sB;

            const pA = priorityMap[a.properties.priority] ?? 0;
            const pB = priorityMap[b.properties.priority] ?? 0;
            if (pA !== pB) return pB - pA;

            return a.title.localeCompare(b.title);
        });
    }, [tasks, search, showCompleted, sortBy]);

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

    const handleCreateTask = () => {
        setEditingTask(null); 
        setIsModalVisible(true);
    };

    const handleSaveNewTask = async (newTask: RichTask) => {
        if (!vaultUri || !folderUri) return;
        
        // Strategy: append to first file in folder or create tasks.md
        let targetFileUri = '';
        let targetFileName = 'tasks.md';
        let targetFilePath = `${folderPath}/${targetFileName}`;
        
        if (tasks.length > 0) {
            targetFileUri = tasks[0].fileUri;
            targetFileName = tasks[0].fileName;
            targetFilePath = tasks[0].filePath;
        } else {
             if (tasks.length === 0) {
                 Alert.alert("No File Found", "Please create a markdown file in this folder first to add tasks.");
                 return;
             }
        }
        
        try {
            const baseAddedTask = await TaskService.addTask(vaultUri, targetFileUri, newTask);
            const addedTask: TaskWithSource = {
                ...baseAddedTask,
                filePath: targetFilePath,
                fileName: targetFileName,
                fileUri: targetFileUri
            };
            setTasks(prev => [...prev, addedTask]);
            setIsModalVisible(false);
            Toast.show({ type: 'success', text1: 'Task Created' });
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Create Failed', text2: 'Could not save new task.' });
        }
    };

    const handleSaveEdit = async (updatedTask: RichTask, targetTaskOverride?: TaskWithSource) => {
        const target = targetTaskOverride || editingTask;
        if (!target || !vaultUri) return;

        try {
            await TaskService.syncTaskUpdate(vaultUri, target, updatedTask);
            setTasks(prev => prev.map(t => 
                (t.fileUri === target.fileUri && t.originalLine === target.originalLine) ? { ...t, ...updatedTask, originalLine: serializeTaskLine(updatedTask) } : t
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
                            setTasks(prev => prev.filter(t => 
                                !(t.fileUri === task.fileUri && t.originalLine === task.originalLine)
                            ));
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

    const handleMergeRequest = () => {
        if (filteredTasks.length === 0) {
            Toast.show({ type: 'info', text1: 'No tasks to merge' });
            return;
        }
        setMergeFileName('');
        setMergeScope('all'); // Default to all
        setIsMergeModalVisible(true);
    };

    const executeMerge = async () => {
        if (!mergeFileName.trim()) {
            Toast.show({ type: 'error', text1: 'Please enter a filename' });
            return;
        }
        
        let targetName = mergeFileName.trim();
        if (!targetName.endsWith('.md')) targetName += '.md';

        setIsMergeModalVisible(false);
        setIsLoading(true);

        const tasksToMerge = mergeScope === 'all' ? tasks : filteredTasks;

        try {
            await TaskService.mergeTasks(vaultUri!, tasksToMerge, folderUri, targetName);
            Toast.show({ type: 'success', text1: 'Tasks merged successfully' });
            loadTasks(true); // Refresh list
        } catch (e) {
            console.error('[TasksFolderView] Merge failed', e);
            Toast.show({ type: 'error', text1: 'Merge failed' });
            setIsLoading(false); 
        }
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
                onMergeTasks={handleMergeRequest}
                sortBy={sortBy}
                onToggleSort={() => setIsSortSheetVisible(true)}
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
                        onUpdate={(updated) => handleSaveEdit(updated, item)} // Need to modify handleSaveEdit to accept task or use current logic
                        fileName={item.fileName}
                        showGuide={item.showGuide}
                        isFirstInFile={item.isFirstInFile}
                        isLastInFile={item.isLastInFile}
                        onStatusLongPress={() => {
                            setActiveTaskForSheet(item);
                            setIsStatusSheetVisible(true);
                        }}
                        onPriorityLongPress={() => {
                            setActiveTaskForSheet(item);
                            setIsPrioritySheetVisible(true);
                        }}
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

            {editingTask !== undefined && (
                <TaskEditModal
                    visible={isModalVisible}
                    task={editingTask}
                    onCancel={() => {
                        setIsModalVisible(false);
                        setEditingTask(null);
                    }}
                    onSave={editingTask ? handleSaveEdit : handleSaveNewTask}
                />
            )}

            <FloatingActionButton 
                onPress={handleCreateTask}
                style={{ position: 'absolute', bottom: 24, right: 24 }}
            />

            {/* Merge Filename Prompt Modal */}
            <Modal
                visible={isMergeModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsMergeModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center items-center bg-black/50 p-6"
                >
                    <View className="w-full bg-slate-900 rounded-xl border border-slate-700 p-4">
                        <Text className="text-lg font-bold text-white mb-2">Merge Tasks to File</Text>
                        <Text className="text-slate-400 mb-4">
                            {mergeScope === 'all' ? `All ${tasks.length} tasks` : `${filteredTasks.length} visible tasks`} will be moved to this new file.
                        </Text>

                        {/* Show scope toggle only if there's a difference */}
                        {filteredTasks.length !== tasks.length && (
                            <View className="flex-row gap-2 mb-4">
                                <TouchableOpacity
                                    onPress={() => setMergeScope('all')}
                                    className={`flex-1 py-2 rounded-lg border ${mergeScope === 'all' ? 'border-indigo-500 bg-indigo-900/30' : 'border-slate-700 bg-slate-800'}`}
                                >
                                    <Text className={`text-center font-medium ${mergeScope === 'all' ? 'text-indigo-300' : 'text-slate-400'}`}>All ({tasks.length})</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setMergeScope('filtered')}
                                    className={`flex-1 py-2 rounded-lg border ${mergeScope === 'filtered' ? 'border-indigo-500 bg-indigo-900/30' : 'border-slate-700 bg-slate-800'}`}
                                >
                                    <Text className={`text-center font-medium ${mergeScope === 'filtered' ? 'text-indigo-300' : 'text-slate-400'}`}>Visible ({filteredTasks.length})</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        <Text className="text-slate-300 text-sm mb-1 ml-1">New Filename</Text>
                        <TextInput
                            className="bg-slate-800 text-white p-3 rounded-lg border border-slate-700 mb-6"
                            placeholder="e.g. MyProject"
                            placeholderTextColor="#64748b"
                            value={mergeFileName}
                            onChangeText={setMergeFileName}
                            autoFocus
                        />

                        <View className="flex-row justify-end gap-3">
                            <TouchableOpacity 
                                onPress={() => setIsMergeModalVisible(false)}
                                className="px-4 py-2"
                            >
                                <Text className="text-slate-400 font-medium">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={executeMerge}
                                className="bg-indigo-600 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-white font-medium">Merge Tasks</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Status Picker Sheet */}
            <SelectionSheet
                visible={isStatusSheetVisible}
                title="Change Status"
                options={STATUS_OPTIONS}
                onSelect={(option) => {
                    if (activeTaskForSheet) {
                        const newStatus = option.id;
                        const updatedTask: RichTask = { ...activeTaskForSheet, status: newStatus, completed: newStatus === 'x' };
                        handleSaveEdit(updatedTask, activeTaskForSheet);
                    }
                }}
                onClose={() => setIsStatusSheetVisible(false)}
            />

            {/* Priority Picker Sheet */}
            <SelectionSheet
                visible={isPrioritySheetVisible}
                title="Set Priority"
                options={PRIORITY_OPTIONS}
                onSelect={(option) => {
                    if (activeTaskForSheet) {
                        const newProps = { ...activeTaskForSheet.properties };
                        if (option.id === 'clear') {
                            delete newProps.priority;
                        } else {
                            newProps.priority = option.id;
                        }
                        const updatedTask: RichTask = { ...activeTaskForSheet, properties: newProps };
                        handleSaveEdit(updatedTask, activeTaskForSheet);
                    }
                }}
                onClose={() => setIsPrioritySheetVisible(false)}
            />

            {/* Sort Picker Sheet */}
            <SelectionSheet
                visible={isSortSheetVisible}
                title="Sort Tasks By"
                options={SORT_OPTIONS}
                onSelect={(option) => setSortBy(option.id as any)}
                onClose={() => setIsSortSheetVisible(false)}
            />
        </View>
    );
}
