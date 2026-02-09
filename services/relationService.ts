import { StorageAccessFramework } from 'expo-file-system/legacy';
import { checkDirectoryExists } from '../utils/saf';
import { parseTaskLine, RichTask } from '../utils/taskParser';
import { TaskWithSource } from '../store/tasks';
import { useRelationsStore, RelationData } from '../store/relations';
import { TaskService } from './taskService';

export class RelationService {

    /**
     * Scans the tasks root recursively for linked events.
     * Updates the global RelationStore.
     */
    static async scanRelations(vaultUri: string, tasksRoot: string) {
        if (!tasksRoot) return;

        const rootUri = await checkDirectoryExists(vaultUri, tasksRoot);
        if (!rootUri) return;

        const relations: Record<string, RelationData> = {};

        // Helper to add relation
        const addRelation = (eventId: string, type: 'task' | 'note', item: any) => {
            if (!relations[eventId]) relations[eventId] = { tasks: [], notes: [] };
            if (type === 'task') relations[eventId].tasks.push(item);
            else relations[eventId].notes.push(item);
        };

        async function walk(uri: string, path: string) {
            try {
                const children = await StorageAccessFramework.readDirectoryAsync(uri);
                for (const childUri of children) {
                    const decoded = decodeURIComponent(childUri);
                    const parts = decoded.split('/');
                    const lastPart = parts[parts.length - 1];
                    const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;

                    try {
                        // Try recursing as directory
                        await StorageAccessFramework.readDirectoryAsync(childUri);
                        await walk(childUri, `${path}/${name}`);
                    } catch {
                        // File
                        if (name.endsWith('.md')) {
                            try {
                                const content = await StorageAccessFramework.readAsStringAsync(childUri);

                                // 1. Scan Frontmatter for Note Links
                                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                                if (frontmatterMatch) {
                                    const fm = frontmatterMatch[1];

                                    // Check event_ids: [id1, id2]
                                    const idsMatch = fm.match(/event_ids:\s*\[(.*?)\]/);
                                    if (idsMatch) {
                                        const ids = idsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
                                        ids.forEach(id => {
                                            if (id) addRelation(id, 'note', {
                                                fileUri: childUri,
                                                filePath: `${path}/${name}`,
                                                fileName: name,
                                                title: name.replace('.md', '')
                                            });
                                        });
                                    }

                                    // Check event_id: id (single)
                                    const idMatch = fm.match(/event_id:\s*(.+)/);
                                    if (idMatch && !idsMatch) {
                                        const id = idMatch[1].trim().replace(/['"]/g, '');
                                        if (id) addRelation(id, 'note', {
                                            fileUri: childUri,
                                            filePath: `${path}/${name}`,
                                            fileName: name,
                                            title: name.replace('.md', '')
                                        });
                                    }
                                }

                                // 2. Scan Tasks for Task Links
                                const lines = content.split('\n');
                                lines.forEach(line => {
                                    const parsed = parseTaskLine(line);
                                    if (parsed && parsed.properties['event_id']) {
                                        const eventIds = parsed.properties['event_id'].split(',').map(s => s.trim());
                                        eventIds.forEach(id => {
                                            if (id) addRelation(id, 'task', {
                                                ...parsed,
                                                filePath: `${path}/${name}`,
                                                fileName: name,
                                                fileUri: childUri
                                            });
                                        });
                                    }
                                });

                            } catch (e) {
                                console.warn(`[RelationService] Failed to read ${name}`, e);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[RelationService] Error walking ${path}`, e);
            }
        }

        await walk(rootUri, tasksRoot);

        // Batch update store
        useRelationsStore.getState().setRelations(relations);
    }

    /**
     * Links a list of tasks to an event.
     * Appends [event_id:: <eventId>] to the tasks.
     */
    static async linkTasksToEvent(vaultUri: string, eventId: string, tasks: TaskWithSource[]) {
        for (const task of tasks) {
            try {
                const currentIds = task.properties['event_id']
                    ? task.properties['event_id'].split(',').map(s => s.trim())
                    : [];

                if (!currentIds.includes(eventId)) {
                    currentIds.push(eventId);

                    const newProps = { ...task.properties, event_id: currentIds.join(', ') };
                    const updatedTask: RichTask = { ...task, properties: newProps };

                    await TaskService.syncTaskUpdate(vaultUri, task, updatedTask);

                    // Update Store Optimistically
                    useRelationsStore.getState().addTaskLink(eventId, { ...updatedTask, fileUri: task.fileUri, filePath: task.filePath, fileName: task.fileName } as TaskWithSource);
                }
            } catch (e) {
                console.error(`[RelationService] Failed to link task ${task.title}`, e);
            }
        }
    }

    /**
     * Unlinks a list of tasks from an event.
     * Removes eventId from [event_id:: ...].
     */
    static async unlinkTasksFromEvent(vaultUri: string, eventId: string, tasks: TaskWithSource[]) {
        for (const task of tasks) {
            try {
                if (!task.properties['event_id']) continue;

                const currentIds = task.properties['event_id'].split(',').map(s => s.trim());
                const newIds = currentIds.filter(id => id !== eventId);

                const newProps = { ...task.properties };
                if (newIds.length > 0) {
                    newProps['event_id'] = newIds.join(', ');
                } else {
                    delete newProps['event_id'];
                }

                const updatedTask: RichTask = { ...task, properties: newProps };

                await TaskService.syncTaskUpdate(vaultUri, task, updatedTask);

                // Update Store Optimistically
                useRelationsStore.getState().removeTaskLink(eventId, task);
            } catch (e) {
                console.error(`[RelationService] Failed to unlink task ${task.title}`, e);
            }
        }
    }
}
