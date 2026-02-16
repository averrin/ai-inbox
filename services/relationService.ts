import { StorageAccessFramework } from 'expo-file-system/legacy';
import { checkDirectoryExists } from '../utils/saf';
import { parseTaskLine, RichTask } from '../utils/taskParser';
import { TaskWithSource } from '../store/tasks';
import { useRelationsStore, RelationData } from '../store/relations';
import { TaskService } from './taskService';

export class RelationService {

    private static isGCInProgress = false;

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
     * Appends [event_id:: <eventId>] and [event_title:: <eventTitle>] to the tasks.
     */
    static async linkTasksToEvent(vaultUri: string, eventId: string, eventTitle: string, tasks: TaskWithSource[]) {
        if (!eventId || eventId === 'undefined' || eventId === 'null') {
            console.error('[RelationService] Attempted to link tasks to invalid eventId:', eventId);
            return;
        }

        for (const task of tasks) {
            try {
                const currentIds = task.properties['event_id']
                    ? task.properties['event_id'].split(',').map(s => s.trim())
                    : [];

                if (!currentIds.includes(eventId)) {
                    currentIds.push(eventId);

                    const newProps = {
                        ...task.properties,
                        event_id: currentIds.join(', '),
                        event_title: eventTitle
                    };
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
                    delete newProps['event_title']; // Also cleanup title if no events left
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

    /**
     * Checks for phantom events (events that no longer exist in the calendar) and removes links.
     * This is a heavy operation, so it should be called sparingly or on specific triggers.
     */
    static async cleanupPhantomEvents(vaultUri: string) {
        if (RelationService.isGCInProgress) {
            console.log('[RelationService] GC already in progress, skipping...');
            return;
        }

        const relations = useRelationsStore.getState().relations;
        const eventIds = Object.keys(relations);

        if (eventIds.length === 0) return;

        RelationService.isGCInProgress = true;
        try {
            console.log(`[RelationService] Running GC on ${eventIds.length} tracked events...`);

            const { ensureCalendarPermissions } = require('./calendarService'); // Late import to avoid cycles
            const Calendar = require('expo-calendar');

            if (!(await ensureCalendarPermissions())) return;

            // Process in chunks to avoid blocking UI too much
            const CHUNK_SIZE = 5;
            for (let i = 0; i < eventIds.length; i += CHUNK_SIZE) {
                const chunk = eventIds.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(async (eventId) => {
                    // SKIP INVALID IDs to prevent crashes
                    if (!eventId || eventId === 'undefined' || eventId === 'null') {
                        const relation = relations[eventId];
                        if (relation) {
                            console.log(`[RelationService] Cleaning up invalid eventId: "${eventId}"`);
                            await RelationService.unlinkTasksFromEvent(vaultUri, eventId, relation.tasks);
                            // Also clear from store directly just in case logic above misses it due to mismatch
                            const next = { ...useRelationsStore.getState().relations };
                            delete next[eventId];
                            useRelationsStore.getState().setRelations(next);
                        }
                        return;
                    }

                    const relation = relations[eventId];
                    if (!relation || (relation.tasks.length === 0 && relation.notes.length === 0)) return;

                    try {
                        // Try to get the event
                        const event = await Calendar.getEventAsync(eventId);

                        // Check if event is missing OR cancelled
                        const isCancelled = event && (event as any).status === 'CANCELED';

                        if (!event || isCancelled) {
                            console.log(`[RelationService] Phantom event detected (missing or cancelled): ${eventId}, cleaning up...`);
                            await RelationService.unlinkTasksFromEvent(vaultUri, eventId, relation.tasks);

                            // Clean up store
                            const next = { ...useRelationsStore.getState().relations };
                            delete next[eventId];
                            useRelationsStore.getState().setRelations(next);
                        }
                    } catch (e: any) {
                        // Check if error is specifically about format
                        if (e.message && e.message.includes('NumberFormatException')) {
                            console.warn(`[RelationService] Invalid ID format detected: ${eventId}, cleaning up relation.`);
                            await RelationService.unlinkTasksFromEvent(vaultUri, eventId, relation.tasks);
                        } else {
                            console.log(`[RelationService] Phantom event detected (error catch): ${eventId}`, e);
                            await RelationService.unlinkTasksFromEvent(vaultUri, eventId, relation.tasks);
                        }
                    }
                }));
            }
        } finally {
            RelationService.isGCInProgress = false;
        }
    }
}


