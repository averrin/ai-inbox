import { StorageAccessFramework } from 'expo-file-system/legacy';
import { readFileContent, saveToVault, checkDirectoryExists, writeSafe, findFile } from '../utils/saf';
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
                let name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;
                // Ensure name is just the folder name, not a path
                if (name.includes('/')) {
                    name = name.split('/').pop()!;
                }

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
                let name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;
                // Ensure name is just the file/folder name
                if (name.includes('/')) {
                    name = name.split('/').pop()!;
                }

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
        let uri = task.fileUri;
        let content = '';

        // 1. Try Read
        try {
            content = await StorageAccessFramework.readAsStringAsync(uri);
        } catch (e) {
            console.warn(`[TaskService] Failed to read task file at ${uri}, attempting resolution via path`, e);
            // Attempt recovery via path
            if (task.filePath) {
                try {
                    // Try to resolve based on vaultUri + relative path logic
                    // We don't have a direct "resolve path" helper that is super robust for full paths,
                    // but we can try checkDirectoryExists logic if we split path.
                    // Or more simply: if we assume standard structure.
                    // But `findFile` searches in a parent.

                    // Let's assume filePath is relative to vault root?
                    // TaskWithSource.filePath usually includes folders.

                    const parts = task.filePath.split('/').filter(p => p);
                    const filename = parts.pop();
                    if (filename) {
                        const dirPath = parts.join('/');
                        const parentUri = await checkDirectoryExists(vaultUri, dirPath);
                        if (parentUri) {
                            const foundUri = await findFile(parentUri, filename);
                            if (foundUri) {
                                uri = foundUri;
                                content = await StorageAccessFramework.readAsStringAsync(uri);
                                console.log(`[TaskService] Recovered file URI: ${uri}`);
                            }
                        }
                    }
                } catch (recoveryErr) {
                    console.error('[TaskService] Recovery failed', recoveryErr);
                }
            }

            if (!content) {
                console.error(`[TaskService] Could not read file content for ${task.title}`);
                throw new Error('FILE_NOT_FOUND');
            }
        }

        // 2. Update & Write
        try {
            // ensure we use the content from the file to avoid stale references, but we already read it above.
            const newContent = updateTaskInText(content, task, updatedTask);
            await writeSafe(uri, newContent);
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
            console.log('[TaskService] addTask called for:', fileUri);
            let content = '';
            try {
                content = await StorageAccessFramework.readAsStringAsync(fileUri);
                console.log('[TaskService] Read success, length:', content.length);
            } catch (readErr) {
                // If read fails (e.g. empty file created by SAF), assume empty content
                console.warn('[TaskService] Read failed in addTask, assuming empty/new file.', readErr);
                content = '';
            }

            const taskLine = serializeTaskLine(task);
            const newContent = content.endsWith('\n') || content === '' ? content + taskLine + '\n' : content + '\n' + taskLine + '\n';

            console.log('[TaskService] Writing new content...');
            await writeSafe(fileUri, newContent);
            console.log('[TaskService] Write success.');

            return {
                ...task,
                originalLine: taskLine,
            };
        } catch (e: any) {
            console.error('[TaskService] Failed to add task', JSON.stringify(e), e.message);
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
                    // FIX: Ghost Data / Truncation Bug on Android SAF.
                    // We use a "Super Padding" strategy to ensure we overwrite all original bytes.
                    let contentToWrite = updatedContent;
                    if (updatedContent.length < content.length) {
                        const charDiff = content.length - updatedContent.length;
                        // Multiplier 4 used because worst-case: removed 4-byte chars replaced by 1-byte chars.
                        // We must ensure the new file size (in bytes) >= old file size (in bytes).
                        contentToWrite += ' '.repeat(charDiff * 4);
                    }

                    try {
                        await writeSafe(fileUri, contentToWrite);
                    } catch (e) {
                        console.error(`[TaskService] Bulk deletion write failed for ${fileUri}`, e);
                    }
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
