import { StorageAccessFramework } from 'expo-file-system/legacy';
import { readFileContent, saveToVault, checkDirectoryExists } from '../utils/saf';
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
            const newContent = updateTaskInText(content, task, updatedTask);
            await StorageAccessFramework.writeAsStringAsync(task.fileUri, newContent);
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

            await StorageAccessFramework.writeAsStringAsync(fileUri, newContent);

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

    /**
     * Merges a list of tasks into a single new file and removes them from their original files.
     */
    static async mergeTasks(vaultUri: string, tasks: TaskWithSource[], targetFolderUri: string, targetFileName: string): Promise<void> {
        if (tasks.length === 0) return;

        // 1. Prepare content for the new file
        const newFileContent = tasks.map(t => t.originalLine).join('\n') + '\n';

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
            // Check if file exists to append or create?
            // Proposal said "new file", usually implying creation. If it exists, we append.
            let fullTargetUri = targetFolderUri;
            // Construct target URI is hard without knowing if it exists. 
            // We'll use SAF to create or write.
            // Actually, simplest is to create a new file. If we want to append, we'd need to read it first.
            // Let's assume we create a new file for now as per "prompt for its name". 
            // If user types existing name, SAF usually handles duplicate names or we can check.

            // We'll use createFileAsync which creates a new file. If strictly "Merge into one file", maybe we append?
            // "Enter name for the new file" suggests creation. 

            const newFileUri = await StorageAccessFramework.createFileAsync(targetFolderUri, targetFileName, 'text/markdown');
            await StorageAccessFramework.writeAsStringAsync(newFileUri, newFileContent);

            // 5. If new file write succeeded, APPLY deletions to source files
            for (const [uri, newContent] of fileUpdates.entries()) {
                if (newContent.trim().length === 0) {
                    // File is empty, delete it
                    await StorageAccessFramework.deleteAsync(uri, { idempotent: true });
                } else {
                    await StorageAccessFramework.writeAsStringAsync(uri, newContent);
                }
            }

        } catch (e) {
            console.error('[TaskService] Merge failed', e);
            throw e;
        }
    }
}
