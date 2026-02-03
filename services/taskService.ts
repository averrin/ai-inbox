import { StorageAccessFramework } from 'expo-file-system/legacy';
import { readFileContent, saveToVault, checkDirectoryExists } from '../utils/saf';
import { parseTaskLine, RichTask, updateTaskInText, removeTaskFromText } from '../utils/taskParser';
import { TaskWithSource } from '../store/tasks';

export interface FolderGroup {
    name: string;
    path: string;
    uri: string;
}

export class TaskService {
    /**
     * Scans the tasks root for subfolders.
     */
    static async getFolderGroups(vaultUri: string, tasksRoot: string): Promise<FolderGroup[]> {
        if (!tasksRoot) return [];

        const rootUri = await checkDirectoryExists(vaultUri, tasksRoot);
        if (!rootUri) return [];

        try {
            const children = await StorageAccessFramework.readDirectoryAsync(rootUri);
            const groups: FolderGroup[] = [];

            for (const uri of children) {
                const decoded = decodeURIComponent(uri);
                const parts = decoded.split('/');
                const lastPart = parts[parts.length - 1];
                const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;

                // Try reading as dir to confirm it's a folder
                try {
                    await StorageAccessFramework.readDirectoryAsync(uri);
                    groups.push({
                        name,
                        path: `${tasksRoot}/${name}`,
                        uri,
                    });
                } catch {
                    // Not a directory, skip
                }
            }

            return groups;
        } catch (e) {
            console.error('[TaskService] Failed to get folder groups', e);
            return [];
        }
    }

    /**
     * Scans a folder (and subfolders) for all tasks in .md files.
     */
    static async scanTasksInFolder(folderUri: string, folderPath: string): Promise<TaskWithSource[]> {
        const tasks: TaskWithSource[] = [];

        async function walk(uri: string, path: string) {
            const children = await StorageAccessFramework.readDirectoryAsync(uri);

            for (const childUri of children) {
                const decoded = decodeURIComponent(childUri);
                const parts = decoded.split('/');
                const lastPart = parts[parts.length - 1];
                const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;

                try {
                    // Recurse if directory
                    const subChildren = await StorageAccessFramework.readDirectoryAsync(childUri);
                    await walk(childUri, `${path}/${name}`);
                } catch {
                    // It's a file
                    if (name.endsWith('.md')) {
                        try {
                            const content = await StorageAccessFramework.readAsStringAsync(childUri);
                            const lines = content.split('\n');

                            lines.forEach(line => {
                                const parsed = parseTaskLine(line);
                                if (parsed) {
                                    tasks.push({
                                        ...parsed,
                                        filePath: `${path}/${name}`,
                                        fileName: name,
                                        fileUri: childUri,
                                    });
                                }
                            });
                        } catch (e) {
                            console.warn(`[TaskService] Failed to read ${name}`, e);
                        }
                    }
                }
            }
        }

        await walk(folderUri, folderPath);
        return tasks;
    }

    /**
     * Updates an existing task in its source file.
     */
    static async syncTaskUpdate(vaultUri: string, task: TaskWithSource, updatedTask: RichTask): Promise<void> {
        try {
            const content = await StorageAccessFramework.readAsStringAsync(task.fileUri);
            const newContent = updateTaskInText(content, task, updatedTask);
            await StorageAccessFramework.writeAsStringAsync(task.fileUri, newContent);
        } catch (e) {
            console.error(`[TaskService] Failed to sync update for ${task.title}`, e);
            throw e;
        }
    }

    /**
     * Deletes a task line from its source file.
     */
    static async syncTaskDeletion(vaultUri: string, task: TaskWithSource): Promise<void> {
        try {
            const content = await StorageAccessFramework.readAsStringAsync(task.fileUri);
            const newContent = removeTaskFromText(content, task);
            await StorageAccessFramework.writeAsStringAsync(task.fileUri, newContent);
        } catch (e) {
            console.error(`[TaskService] Failed to sync deletion for ${task.title}`, e);
            throw e;
        }
    }

    static async syncBulkDeletion(vaultUri: string, tasks: TaskWithSource[]) {
        if (tasks.length === 0) return;
        const fileUri = tasks[0].fileUri;

        try {
            const content = await StorageAccessFramework.readAsStringAsync(fileUri);
            let updatedContent = content;

            for (const task of tasks) {
                updatedContent = removeTaskFromText(updatedContent, task);
            }

            await StorageAccessFramework.writeAsStringAsync(fileUri, updatedContent);
        } catch (e) {
            console.error('[TaskService] Bulk deletion failed', e);
            throw e;
        }
    }
}
