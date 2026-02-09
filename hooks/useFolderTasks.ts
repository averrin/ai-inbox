import { useState, useCallback, useEffect } from 'react';
import { TaskService } from '../services/taskService';
import { useSettingsStore } from '../store/settings';
import { useTasksStore, TaskWithSource } from '../store/tasks';
import { useVaultStore } from '../services/vaultService';
import Toast from 'react-native-toast-message';

export function useFolderTasks(folderUri: string, folderPath: string) {
    const { vaultUri } = useSettingsStore();
    const { tasksRoot } = useTasksStore();
    const [tasks, setTasks] = useState<TaskWithSource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadTasks = useCallback(async (refresh = false) => {
        if (!folderUri) return;
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            // Also refresh vault structure to get latest property suggestions
            if (vaultUri && tasksRoot) {
                // We don't await this to avoid blocking UI
                useVaultStore.getState().refreshStructure(vaultUri, tasksRoot);
            }
            const result = await TaskService.scanTasksInFolder(folderUri, folderPath);
            setTasks(result);
        } catch (e) {
            console.error('[useFolderTasks] Failed to load tasks', e);
            Toast.show({
                type: 'error',
                text1: 'Load Failed',
                text2: 'Could not read tasks from this folder.'
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [folderUri, folderPath, vaultUri, tasksRoot]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    return {
        tasks,
        setTasks,
        isLoading,
        isRefreshing,
        loadTasks
    };
}
