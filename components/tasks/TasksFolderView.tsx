import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Text, Modal, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TaskWithSource } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { TaskService } from '../../services/taskService';
import { TaskEditModal } from '../markdown/TaskEditModal';
import { TasksFilterPanel } from './TasksFilterPanel';
import { RichTask, serializeTaskLine } from '../../utils/taskParser';
import Toast from 'react-native-toast-message';
import { useFolderTasks } from '../../hooks/useFolderTasks';
import { useFilteredTasks } from '../../hooks/useFilteredTasks';
import { TasksList } from './TasksList';
import { SelectionSheet, SelectionOption } from '../ui/SelectionSheet';
import { EventFormModal, EventSaveData } from '../EventFormModal';
import * as Calendar from 'expo-calendar';
import { ensureDirectory } from '../../utils/saf';
import { useFab } from '../../hooks/useFab';
import { Colors } from '../ui/design-tokens';
import { showAlert, showError } from '../../utils/alert';


interface TasksFolderViewProps {
    folderUri: string;
    folderPath: string;
}

export function TasksFolderView({ folderUri, folderPath }: TasksFolderViewProps) {
    const { vaultUri } = useSettingsStore();

    const { tasks, setTasks, isLoading, isRefreshing, loadTasks } = useFolderTasks(folderUri, folderPath);

    // Filter State
    const [search, setSearch] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    const [sortBy, setSortBy] = useState<'smart' | 'file' | 'title' | 'priority'>('smart');
    const [isSortSheetVisible, setIsSortSheetVisible] = useState(false);

    const filteredTasks = useFilteredTasks(tasks, search, showCompleted, sortBy);

    // Edit Modal State
    const [editingTask, setEditingTask] = useState<TaskWithSource | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any | null>(null);

    // Merge Modal State
    const [isMergeModalVisible, setIsMergeModalVisible] = useState(false);
    const [mergeFileName, setMergeFileName] = useState('');
    const [mergeScope, setMergeScope] = useState<'all' | 'filtered'>('all');

    const SORT_OPTIONS: SelectionOption[] = [
        { id: 'smart', label: 'Smart Sort (Status + Priority)', icon: 'flash-outline', color: '#818cf8' },
        { id: 'file', label: 'File Order', icon: 'document-text-outline', color: Colors.text.tertiary },
        { id: 'title', label: 'Alphabetical (Title)', icon: 'text-outline', color: Colors.text.tertiary },
        { id: 'priority', label: 'Priority Only', icon: 'flag-outline', color: Colors.error },
    ];

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

    const handleCreateTask = useCallback(() => {
        setEditingTask(null);
        setIsModalVisible(true);
    }, []);


    useFab({
        onPress: handleCreateTask,
        icon: 'add'
    });

    const handleSaveNewTask = async (newTask: RichTask, newFolderPath?: string) => {
        if (!vaultUri || !folderUri) return;

        let targetFolderUri = folderUri;
        let isDifferentFolder = false;

        // Check if user selected a different folder
        if (newFolderPath && newFolderPath.trim() !== folderPath) {
            isDifferentFolder = true;
            try {
                // Resolve URI for the new path
                let current = vaultUri;
                const parts = newFolderPath.split('/').filter(p => p.trim());
                for (const part of parts) {
                    current = await ensureDirectory(current, part);
                }
                targetFolderUri = current;
            } catch (e) {
                console.error("Failed to resolve new folder", e);
                showError("Error", "Could not access selected folder.");
                return;
            }
        }

        try {
            // Find default file in target folder (Inbox.md or Tasks.md or create Inbox.md)
            const defaultFile = await TaskService.findDefaultTaskFile(targetFolderUri);

            const baseAddedTask = await TaskService.addTask(vaultUri, defaultFile.uri, newTask);

            // Only update local list if we stayed in the same folder
            if (!isDifferentFolder) {
                const addedTask: TaskWithSource = {
                    ...baseAddedTask,
                    filePath: `${folderPath}/${defaultFile.name}`,
                    fileName: defaultFile.name,
                    fileUri: defaultFile.uri
                };
                setTasks(prev => [...prev, addedTask]);
            }

            setIsModalVisible(false);
            Toast.show({ type: 'success', text1: isDifferentFolder ? 'Task Created in ' + newFolderPath : 'Task Created' });
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Create Failed', text2: 'Could not save new task.' });
        }
    };

    const handleSaveEdit = async (updatedTask: RichTask, arg2?: string | TaskWithSource) => {
        let newFolderPath: string | undefined;
        let targetTaskOverride: TaskWithSource | undefined;

        if (typeof arg2 === 'string') {
            newFolderPath = arg2;
        } else if (arg2 && typeof arg2 === 'object') {
            targetTaskOverride = arg2;
        }

        const target = targetTaskOverride || editingTask;
        if (!target || !vaultUri) return;

        // Check for folder change
        if (newFolderPath && typeof newFolderPath === 'string') {
            // current folder path
            const currentFolder = target.filePath && target.filePath.includes('/')
                ? target.filePath.substring(0, target.filePath.lastIndexOf('/'))
                : '';

            // Check if changed
            if (newFolderPath !== currentFolder) {
                // === MOVE LOGIC ===
                try {
                    // Resolve URI
                    let targetFolderUri = vaultUri;
                    const parts = newFolderPath.split('/').filter(p => p.trim());
                    for (const part of parts) {
                        targetFolderUri = await ensureDirectory(targetFolderUri, part);
                    }

                    // Add to new
                    const defaultFile = await TaskService.findDefaultTaskFile(targetFolderUri);
                    await TaskService.addTask(vaultUri, defaultFile.uri, updatedTask);

                    // Delete from old
                    await TaskService.syncTaskDeletion(vaultUri, target);

                    // Remove from local list (since it moved out of this view presumably,
                    // or even if it moved to another file in same folder, we might want to refresh or just assume remove?)
                    // If it moved to another file in SAME folder, we should ideally keep it but update fileUri.
                    // But determining if targetFolderUri === folderUri is hard with URIs.
                    // We can check strings: newFolderPath === folderPath.

                    if (newFolderPath === folderPath) {
                        // Moved to another file in same folder (e.g. from Project.md to Inbox.md in same folder)
                        // Update local state
                        const movedTask: TaskWithSource = {
                            ...updatedTask,
                            fileUri: defaultFile.uri,
                            filePath: `${folderPath}/${defaultFile.name}`,
                            fileName: defaultFile.name
                        };

                        setTasks(prev => prev.map(t =>
                            (t.fileUri === target.fileUri && t.originalLine === target.originalLine) ? movedTask : t
                        ));
                    } else {
                        // Moved out of folder
                        setTasks(prev => prev.filter(t =>
                            !(t.fileUri === target.fileUri && t.originalLine === target.originalLine)
                        ));
                    }

                    setIsModalVisible(false);
                    setEditingTask(null);
                    Toast.show({ type: 'success', text1: 'Task Moved' });
                    return;

                } catch (e) {
                    console.error("Failed to move task", e);
                    showError("Error", "Failed to move task.");
                    return;
                }
            }
        }

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
        showAlert(
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

        showAlert(
            "Clear Completed",
            `Are you sure you want to remove all ${completedTasks.length} completed tasks from their files?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        // setIsLoading(true); // Hook manages loading, but we can't force it easily unless we expose setter.
                        // We can just show a toast or rely on async/await.
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
        // setIsLoading(true);

        const tasksToMerge = mergeScope === 'all' ? tasks : filteredTasks;

        try {
            await TaskService.mergeTasks(vaultUri!, tasksToMerge, folderUri, targetName);
            Toast.show({ type: 'success', text1: 'Tasks merged successfully' });
            loadTasks(true); // Refresh list
        } catch (e) {
            console.error('[TasksFolderView] Merge failed', e);
            Toast.show({ type: 'error', text1: 'Merge failed' });
            // setIsLoading(false);
        }
    };

    const handleTagPress = (tag: string) => {
        setSearch(tag);
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

            <TasksList
                tasks={filteredTasks}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                onRefresh={() => loadTasks(true)}
                onToggle={handleToggleTask}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onUpdate={handleSaveEdit}
                onTagPress={handleTagPress}
            />

            {editingTask !== undefined && (
                <TaskEditModal
                    visible={isModalVisible}
                    task={editingTask}
                    enableFolderSelection={true}
                    initialFolder={folderPath}
                    onCancel={() => {
                        setIsModalVisible(false);
                        setEditingTask(null);
                    }}
                    onSave={editingTask ? (task, folder) => handleSaveEdit(task, folder) : (task, folder) => handleSaveNewTask(task, folder)}
                    onOpenEvent={(id) => {
                        setIsModalVisible(false);
                        Calendar.getEventAsync(id).then(evt => {
                            if (evt) setEditingEvent(evt);
                        });
                    }}
                    onDelete={editingTask ? () => {
                        handleDeleteTask(editingTask);
                        setIsModalVisible(false);
                        setEditingTask(null);
                    } : undefined}
                />
            )}

            {editingEvent && (
                <EventFormModal
                    visible={!!editingEvent}
                    initialEvent={editingEvent}
                    timeFormat={useSettingsStore.getState().timeFormat}
                    onCancel={() => setEditingEvent(null)}
                    onSave={() => {
                        setEditingEvent(null);
                        // Refresh if needed, but usually calendar sync handles it
                    }}
                    onOpenTask={(task) => {
                        setEditingEvent(null);
                        setEditingTask(task);
                        setIsModalVisible(true);
                    }}
                />
            )}

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
                    <View className="w-full bg-background rounded-xl border border-border p-4">
                        <Text className="text-lg font-bold text-white mb-2">Merge Tasks to File</Text>
                        <Text className="text-text-tertiary mb-4">
                            {mergeScope === 'all' ? `All ${tasks.length} tasks` : `${filteredTasks.length} visible tasks`} will be moved to this new file.
                        </Text>

                        {/* Show scope toggle only if there's a difference */}
                        {filteredTasks.length !== tasks.length && (
                            <View className="flex-row gap-2 mb-4">
                                <TouchableOpacity
                                    onPress={() => setMergeScope('all')}
                                    className={`flex-1 py-2 rounded-lg border ${mergeScope === 'all' ? 'border-primary bg-surface-highlight' : 'border-border bg-surface'}`}
                                >
                                    <Text className={`text-center font-medium ${mergeScope === 'all' ? 'text-text-secondary' : 'text-text-tertiary'}`}>All ({tasks.length})</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setMergeScope('filtered')}
                                    className={`flex-1 py-2 rounded-lg border ${mergeScope === 'filtered' ? 'border-primary bg-surface-highlight' : 'border-border bg-surface'}`}
                                >
                                    <Text className={`text-center font-medium ${mergeScope === 'filtered' ? 'text-text-secondary' : 'text-text-tertiary'}`}>Visible ({filteredTasks.length})</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <Text className="text-text-secondary text-sm mb-1 ml-1">New Filename</Text>
                        <TextInput
                            className="bg-surface text-white p-3 rounded-lg border border-border mb-6"
                            placeholder="e.g. MyProject"
                            placeholderTextColor={Colors.secondary}
                            value={mergeFileName}
                            onChangeText={setMergeFileName}
                            autoFocus
                        />

                        <View className="flex-row justify-end gap-3">
                            <TouchableOpacity
                                onPress={() => setIsMergeModalVisible(false)}
                                className="px-4 py-2"
                            >
                                <Text className="text-text-tertiary font-medium">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={executeMerge}
                                className="bg-primary px-4 py-2 rounded-lg"
                            >
                                <Text className="text-white font-medium">Merge Tasks</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

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
