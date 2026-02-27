import { firebaseAuth, firebaseDb } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCalendarEvents } from './calendarService';
import { useSettingsStore } from '../store/settings';
import { useTasksStore } from '../store/tasks';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

export class SnapshotService {
    static async captureDailySnapshot(date: Date = new Date()) {
        try {
            const user = firebaseAuth.currentUser;
            if (!user) {
                console.log('[SnapshotService] User not authenticated');
                return;
            }

            const { visibleCalendarIds, focusPanelTaskStatuses } = useSettingsStore.getState();
            const { tasks } = useTasksStore.getState();

            const targetDateStr = dayjs(date).format('YYYY-MM-DD');
            const todayStr = dayjs().format('YYYY-MM-DD');

            // 1. Fetch Events
            let events = [];
            try {
                const startOfDay = dayjs(date).startOf('day').toDate();
                const endOfDay = dayjs(date).endOf('day').toDate();
                events = await getCalendarEvents(visibleCalendarIds, startOfDay, endOfDay);
            } catch (e) {
                console.error('[SnapshotService] Failed to fetch events', e);
            }

            // 2. Filter Tasks (Simplified logic replicating TodaysTasksPanel)
            const filteredTasks = tasks.filter(task => {
                if (!focusPanelTaskStatuses.includes(task.status)) return false;

                const props = task.properties;

                // Matches exact date
                if (props.date === targetDateStr) return true;

                // Matches date range (start - due)
                if (props.start && props.due && dayjs(targetDateStr).isBetween(props.start, props.due, 'day', '[]')) return true;

                // Overdue for today
                if (targetDateStr === todayStr && props.due && dayjs(props.due).isBefore(todayStr, 'day')) return true;

                // Linked events (simplified: include if any event link exists and matches today's events)
                if (props.event_id && props.event_id.split(',').some((id: string) =>
                    events.some((e: any) => {
                        const targetId = id.trim();
                        return e.id === targetId || e.originalEvent?.id === targetId;
                    })
                )) return true;

                return false;
            });

            // 3. Construct Snapshot
            const snapshot = {
                date: targetDateStr,
                generatedAt: serverTimestamp(),
                events: events.map((e: any) => ({
                    id: e.id,
                    title: e.title,
                    startDate: e.startDate,
                    endDate: e.endDate,
                    allDay: e.allDay,
                    location: e.location,
                    description: e.notes || e.description,
                    calendarId: e.calendarId
                })),
                tasks: filteredTasks.map(t => ({
                    title: t.title,
                    status: t.status,
                    properties: t.properties,
                    completed: t.completed,
                    filePath: t.filePath
                })),
                stats: {
                    eventCount: events.length,
                    taskCount: filteredTasks.length,
                    completedTaskCount: filteredTasks.filter(t => t.completed).length
                }
            };

            // 4. Save to Firestore
            const snapshotRef = doc(firebaseDb, `users/${user.uid}/snapshots/${targetDateStr}`);
            await setDoc(snapshotRef, snapshot, { merge: true });

            console.log(`[SnapshotService] Snapshot saved for ${targetDateStr}`);
        } catch (e) {
            console.error('[SnapshotService] Failed to capture snapshot', e);
        }
    }
}
