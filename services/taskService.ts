import { StorageAccessFramework } from 'expo-file-system/legacy';
import { readFileContent, saveToVault, checkDirectoryExists, writeSafe } from '../utils/saf';
import { parseTaskLine, RichTask, updateTaskInText, removeTaskFromText, serializeTaskLine } from '../utils/taskParser';
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
            // ensure we use the content from the file to avoid stale references, but we already read it above.
            const newContent = updateTaskInText(content, task, updatedTask);
            await writeSafe(task.fileUri, newContent);
        } catch (e) {
            console.error(`[TaskService] Failed to sync update for ${task.title}`, e);
            throw e;
        }
    }

    /**
     * Appends a new task to a specific file.
     */
    static async addTask(vaultUri: string, fileUri: string, task: RichTask): Promise<RichTask> {
        try {
            const content = await StorageAccessFramework.readAsStringAsync(fileUri);
            const taskLine = serializeTaskLine(task);
            const newContent = content.endsWith('\n') ? content + taskLine + '\n' : content + '\n' + taskLine + '\n';

            await writeSafe(fileUri, newContent);

            return {
                ...task,
                originalLine: taskLine,
            };
        } catch (e) {
            console.error('[TaskService] Failed to add task', e);
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

            if (content === newContent) {
                console.warn(`[TaskService] Task deletion had no effect: ${task.title}`);
            }

            // Always write if different, or if we want to ensure consistency. 
            // Optimally we only write if changed.
            if (content !== newContent) {
                await writeSafe(task.fileUri, newContent);
            }
        } catch (e) {
            console.error(`[TaskService] Failed to sync deletion for ${task.title}`, e);
            throw e;
        }
    }

    static async syncBulkDeletion(vaultUri: string, tasks: TaskWithSource[]) {
        if (tasks.length === 0) return;

        // Group by file first to minimize IO
        const tasksByFile = tasks.reduce((acc, task) => {
            if (!acc[task.fileUri]) acc[task.fileUri] = [];
            acc[task.fileUri].push(task);
            return acc;
        }, {} as Record<string, TaskWithSource[]>);

        for (const [fileUri, fileTasks] of Object.entries(tasksByFile)) {
            try {
                const content = await StorageAccessFramework.readAsStringAsync(fileUri);
                let updatedContent = content;

                for (const task of fileTasks) {
                    const nextContent = removeTaskFromText(updatedContent, task);
                    if (nextContent === updatedContent) {
                        console.warn(`[TaskService] Bulk deletion skipped missing task: ${task.title}`);
                    }
                    updatedContent = nextContent;
                }

                if (updatedContent !== content) {
                    await writeSafe(fileUri, updatedContent);
                }
            } catch (e) {
                console.error(`[TaskService] Bulk deletion failed for file ${fileUri}`, e);
                // Continue with other files
            }
        }
    }

    /**
     * Merges a list of tasks into a single new file and removes them from their original files.
     */
    static async mergeTasks(vaultUri: string, tasks: TaskWithSource[], targetFolderUri: string, targetFileName: string): Promise<void> {
        if (tasks.length === 0) return;

        // 1. Prepare content for the new file using serialization to clean up formatting
        const newFileContent = tasks.map(t => serializeTaskLine(t)).join('\n') + '\n';

        // 2. Group tasks by source file to prepare updates (removals)
        const tasksByFile = tasks.reduce((acc, task) => {
            if (!acc[task.fileUri]) acc[task.fileUri] = [];
            acc[task.fileUri].push(task);
            return acc;
        }, {} as Record<string, TaskWithSource[]>);

        // 3. Read all source files and prepare their new content in memory (Optimistic preparation)
        const fileUpdates = new Map<string, string>(); // uri -> newContent

        try {
            for (const [uri, fileTasks] of Object.entries(tasksByFile)) {
                const content = await StorageAccessFramework.readAsStringAsync(uri);
                let updatedContent = content;
                for (const task of fileTasks) {
                    updatedContent = removeTaskFromText(updatedContent, task);
                }
                fileUpdates.set(uri, updatedContent);
            }

            // 4. Write the NEW file first (Safe creation)
            const newFileUri = await StorageAccessFramework.createFileAsync(targetFolderUri, targetFileName, 'text/markdown');
            await writeSafe(newFileUri, newFileContent);

            // 5. If new file write succeeded, APPLY deletions to source files
            for (const [uri, newContent] of fileUpdates.entries()) {
                if (newContent.trim().length === 0) {
                    // If file is effectively empty, we might choose to delete it, 
                    // or just write the empty string. 
                    // Ideally we check if it has other content (frontmatter?)
                    // For now, let's just write the new content (even if empty) to be safe.
                    await writeSafe(uri, newContent);
                } else {
                    await writeSafe(uri, newContent);
                }
            }

        } catch (e) {
            console.error('[TaskService] Merge failed', e);
            throw e;
        }
    }
}
