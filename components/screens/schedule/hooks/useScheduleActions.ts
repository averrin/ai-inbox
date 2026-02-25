import { useCallback } from 'react';
import { Platform } from 'react-native';
import dayjs from 'dayjs';
import {
    updateReminder,
    createStandaloneReminder,
    formatRecurrenceForReminder,
    toLocalISOString
} from '../../../../services/reminderService';
import {
    deleteCalendarEvent,
    updateCalendarEvent,
    createCalendarEvent,
    getWritableCalendars
} from '../../../../services/calendarService';
import { showAlert, showError } from '../../../../utils/alert';
import { Colors, Palette } from '../../../ui/design-tokens';
import { useSettingsStore } from '../../../../store/settings';
import { useTasksStore } from '../../../../store/tasks';
import { useRelationsStore } from '../../../../store/relations';
import { TaskService } from '../../../../services/taskService';

interface UseScheduleActionsProps {
    events: any[];
    setEvents: React.Dispatch<React.SetStateAction<any[]>>;
    fetchEvents: () => Promise<void>;
    cachedReminders: any[];
    setCachedReminders: (reminders: any[]) => void;
    vaultUri: string | null;
    completedEvents: Record<string, boolean>;
    toggleCompleted: (title: string, dateStr: string) => void;
    setCreatingEventDate: (date: Date | null) => void;
    setEditingEvent: (event: any | null) => void;
    setPendingLinkTask: (task: any | null) => void;
    setRecurrenceModalVisible: (visible: boolean) => void;
    setPendingEventDrop: (drop: any | null) => void;
    defaultCreateCalendarId: string | null;
    visibleCalendarIds: string[];
    editingEvent: any | null;
    pendingLinkTask: any | null;
}

export const useScheduleActions = ({
    events,
    setEvents,
    fetchEvents,
    cachedReminders,
    setCachedReminders,
    vaultUri,
    completedEvents,
    toggleCompleted,
    setCreatingEventDate,
    setEditingEvent,
    setPendingLinkTask,
    setRecurrenceModalVisible,
    setPendingEventDrop,
    defaultCreateCalendarId,
    visibleCalendarIds,
    editingEvent,
    pendingLinkTask
}: UseScheduleActionsProps) => {

    const handleDeleteEvent = async (options: any) => {
        // Reminder Deletion
        if (editingEvent?.typeTag === 'REMINDER' || editingEvent?.originalEvent?.fileUri) {
            const reminder = editingEvent.originalEvent;
            const targetUri = reminder.fileUri;

            setCreatingEventDate(null);
            setEditingEvent(null);

            setCachedReminders(cachedReminders.filter((r: any) => r.fileUri !== targetUri));

            try {
                await updateReminder(targetUri, null);
            } catch (e) {
                console.error("Failed to delete reminder:", e);
                showError("Error", "Failed to delete reminder");
                fetchEvents();
            }
            return;
        }

        // Calendar Event Deletion
        if (!editingEvent) return;
        const originalId = editingEvent.originalEvent?.id;

        setCreatingEventDate(null);
        setEditingEvent(null);

        setEvents(prev => prev.filter(e => e.originalEvent?.id !== originalId));

        try {
            const targetId = editingEvent.originalEvent?.originalId || originalId;
            const instanceStartDate = editingEvent.originalEvent?.startDate;

            const apiOptions: any = {};
            const scope = options.scope;

            if (scope === 'this') {
                apiOptions.instanceStartDate = instanceStartDate ? new Date(instanceStartDate) : undefined;
            } else if (scope === 'future') {
                apiOptions.instanceStartDate = instanceStartDate ? new Date(instanceStartDate) : undefined;
                apiOptions.futureEvents = true;
            }

            await deleteCalendarEvent(targetId, apiOptions);

            setTimeout(() => {
                fetchEvents();
            }, 500);
        } catch (e) {
            console.error("Failed to delete event", e);
            showError("Error", 'Failed to delete event');
            fetchEvents();
        }
    };

    const handleSaveEvent = async (data: any) => {
        setCreatingEventDate(null);
        setEditingEvent(null);

        if (data.type === 'reminder' || data.type === 'alarm') {
            const reminderTime = data.startDate.toISOString();
            const recurrenceStr = formatRecurrenceForReminder(data.recurrenceRule);
            const content = data.content;

            if (editingEvent) {
                const originalReminder = editingEvent.originalEvent;
                const targetUri = originalReminder.fileUri;
                const isNew = originalReminder.isNew;

                const updatedReminder = {
                    ...originalReminder,
                    reminderTime,
                    recurrenceRule: recurrenceStr,
                    alarm: data.alarm,
                    persistent: data.persistent,
                    title: data.title,
                    content: content
                };

                if (isNew) {
                    setCachedReminders([...cachedReminders, updatedReminder]);
                } else {
                    const newCache = cachedReminders.map((r: any) =>
                        r.fileUri === targetUri ? updatedReminder : r
                    );
                    setCachedReminders(newCache);
                }

                try {
                    if (isNew) {
                        const result = await createStandaloneReminder(reminderTime, data.title, recurrenceStr, data.alarm, data.persistent, {}, [], undefined, content);
                        if (result) {
                            const { cachedReminders, setCachedReminders } = useSettingsStore.getState();
                            const updatedCache = cachedReminders.map((r: any) => {
                                if (r.fileUri === targetUri) return { ...r, fileUri: result.uri, isNew: false, fileName: result.fileName };
                                return r;
                            });
                            setCachedReminders(updatedCache);
                            fetchEvents();
                        }
                    } else {
                        await updateReminder(targetUri!, reminderTime, recurrenceStr, data.alarm, data.persistent, data.title, content);
                    }
                } catch (e) {
                    console.error("Failed to save reminder:", e);
                }
            } else {
                const tempUri = `temp-${Date.now()}`;
                const tempReminder: any = {
                    id: tempUri,
                    fileUri: tempUri,
                    fileName: data.title || 'Reminder',
                    title: data.title,
                    reminderTime,
                    recurrenceRule: recurrenceStr,
                    alarm: data.alarm,
                    persistent: data.persistent,
                    content: content || 'Created via Calendar',
                };

                setCachedReminders([...(cachedReminders || []), tempReminder]);

                try {
                    const result = await createStandaloneReminder(reminderTime, data.title, recurrenceStr, data.alarm, data.persistent, {}, [], undefined, content);
                    if (result) {
                        const { cachedReminders, setCachedReminders } = useSettingsStore.getState();
                        const updatedCache = (cachedReminders || []).map((r: any) => {
                            if (r.fileUri === tempUri) return { ...r, id: result.uri, fileUri: result.uri, fileName: result.fileName };
                            return r;
                        });
                        setCachedReminders(updatedCache);
                        fetchEvents();
                    }
                } catch (e) {
                    console.error("Failed to create reminder:", e);
                }
            }
            return;
        }

        if (editingEvent) {
            const originalId = editingEvent.originalEvent?.id;
            if (!originalId) {
                showAlert("Syncing", "This event is still syncing. Please try again in a moment.");
                fetchEvents();
                return;
            }

            const updatedEvent = { ...editingEvent, title: data.title, start: data.startDate, end: data.endDate };
            setEvents(prev => prev.map(e => (e.originalEvent?.id === originalId) ? updatedEvent : e));

            try {
                const targetId = editingEvent.originalEvent?.originalId || originalId;
                const rawStartDate = editingEvent.originalEvent?.startDate;
                const instanceStartDate = rawStartDate ? new Date(rawStartDate) : undefined;

                let finalTitle = data.title;
                if (editingEvent.type === 'zone' && !finalTitle.startsWith('[Zone] ')) finalTitle = `[Zone] ${finalTitle}`;

                let finalContent = editingEvent.originalEvent?.content;
                if (data.type === 'zone') {
                    let baseContent = (finalContent || '').replace(/\[color::.*?\]/g, '').replace(/\[nonFree::.*?\]/g, '').trim();
                    if (data.color) baseContent += `\n[color::${data.color}]`;
                    if (data.isNonFree) baseContent += `\n[nonFree::true]`;
                    finalContent = baseContent;
                }

                await updateCalendarEvent(targetId, {
                    title: finalTitle,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    allDay: data.allDay,
                    isWork: data.isWork,
                    recurrenceRule: data.recurrenceRule,
                    editScope: data.editScope,
                    instanceStartDate: instanceStartDate,
                    content: finalContent
                });

                setTimeout(() => fetchEvents(), 500);
            } catch (e) {
                console.error("Failed to update event", e);
                showError("Error", 'Failed to update event');
                fetchEvents();
            }
            return;
        }

        let finalTitle = data.title;
        let finalContent = undefined;
        let optimisticColor = '#818cf8';

        if (data.type === 'zone') {
            finalTitle = `[Zone] ${data.title}`;
            let baseContent = (data.content || '').replace(/\[color::.*?\]/g, '').replace(/\[nonFree::.*?\]/g, '').trim();
            if (data.color) baseContent += `\n[color::${data.color}]`;
            if (data.isNonFree) baseContent += `\n[nonFree::true]`;
            finalContent = baseContent;
            optimisticColor = data.color || optimisticColor;
        }

        const tempId = `optimistic-${Date.now()}`;
        const tempEvent = {
            id: tempId,
            title: finalTitle,
            start: data.startDate,
            end: data.endDate,
            color: optimisticColor,
            type: data.type === 'zone' ? 'zone' : undefined,
            originalEvent: {
                id: tempId,
                title: finalTitle,
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString(),
                content: finalContent,
                isOptimistic: true
            }
        };
        setEvents([...events, tempEvent]);

        try {
            const calendars = await getWritableCalendars();
            let targetCalendarId = data.calendarId || defaultCreateCalendarId;
            let targetCalendar = calendars.find(c => c.id === targetCalendarId && c.allowsModifications);
            if (!targetCalendar && visibleCalendarIds.length > 0) targetCalendar = calendars.find(c => c.id === visibleCalendarIds[0] && c.allowsModifications);
            if (!targetCalendar && calendars.length > 0) targetCalendar = calendars[0];

            if (!targetCalendar) {
                showError("Error", 'No suitable calendar found to create event.');
                fetchEvents();
                return;
            }

            const createdEventId = await createCalendarEvent(targetCalendar.id, {
                title: finalTitle,
                startDate: data.startDate,
                endDate: data.endDate,
                allDay: data.allDay,
                isWork: data.isWork,
                notes: finalContent,
                recurrenceRule: data.recurrenceRule,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            });

            if (pendingLinkTask) {
                const updatedTask = {
                    ...pendingLinkTask,
                    properties: { ...pendingLinkTask.properties, event_id: createdEventId }
                };
                if (vaultUri) await TaskService.syncTaskUpdate(vaultUri, pendingLinkTask, updatedTask);
                const { tasks, setTasks } = useTasksStore.getState();
                const updatedTasks = tasks.map(t => (t.filePath === pendingLinkTask.filePath && t.originalLine === pendingLinkTask.originalLine) ? updatedTask : t);
                setTasks(updatedTasks);
                setPendingLinkTask(null);
            }

            setTimeout(() => fetchEvents(), 500);
        } catch (e) {
            console.error("[ScheduleScreen] Failed to create event:", e);
            showError("Error", 'Failed to create event. Check logs.');
            fetchEvents();
        }
    };

    const handleEventDrop = async (event: any, newDate: Date) => {
        if (event.typeTag === 'WALK_SUGGESTION' || event.typeTag === 'LUNCH_SUGGESTION') {
            const isWalk = event.typeTag === 'WALK_SUGGESTION';
            const title = isWalk ? 'Walk' : 'Lunch';
            const duration = dayjs(event.end).diff(dayjs(event.start), 'millisecond') || (60 * 60 * 1000);
            const newStart = newDate;
            const newEnd = new Date(newStart.getTime() + duration);

            const tempEvent = {
                title: title,
                start: newStart,
                end: newEnd,
                color: isWalk ? Palette[9] : Colors.primary,
                originalEvent: { title: title, startDate: newStart.toISOString(), endDate: newEnd.toISOString() }
            };
            setEvents(prev => [...prev, tempEvent]);

            try {
                const calendars = await getWritableCalendars();
                let targetCalendar;
                if (defaultCreateCalendarId) targetCalendar = calendars.find(c => c.id === defaultCreateCalendarId && c.allowsModifications);
                if (!targetCalendar && visibleCalendarIds.length > 0) targetCalendar = calendars.find(c => c.id === visibleCalendarIds[0] && c.allowsModifications);
                if (!targetCalendar && calendars.length > 0) targetCalendar = calendars[0];

                if (!targetCalendar) {
                    showError("Error", 'No suitable calendar found to schedule suggestion.');
                    fetchEvents();
                    return;
                }

                await createCalendarEvent(targetCalendar.id, {
                    title: title,
                    startDate: newStart,
                    endDate: newEnd,
                    notes: isWalk ? 'Scheduled Walk' : 'Scheduled Lunch'
                });
                setTimeout(() => fetchEvents(), 500);
            } catch (e) {
                console.error("Failed to schedule suggestion drop", e);
                showError("Error", "Failed to schedule suggestion.");
                fetchEvents();
            }
            return;
        }

        const isReminder = event.typeTag === 'REMINDER' || !!event.originalEvent?.fileUri;
        const isPersonalEvent = event.isPersonal && event.originalEvent?.id;

        if (!isReminder && !isPersonalEvent) {
            showAlert("Restricted", 'Only reminders and personal events can be rescheduled.');
            return;
        }

        if (isReminder) {
            const originalReminder = event.originalEvent;
            const newTimeStr = toLocalISOString(newDate);
            const updatedReminders = cachedReminders.map((r: any) => r.fileUri === originalReminder.fileUri ? { ...r, reminderTime: newTimeStr } : r);
            setCachedReminders(updatedReminders);

            try {
                await updateReminder(originalReminder.fileUri, newTimeStr);
            } catch (e) {
                console.error('[ScheduleScreen] Failed to update reminder drop', e);
                showError("Error", 'Failed to reschedule reminder.');
                fetchEvents();
            }
        } else {
            try {
                const duration = dayjs(event.end).diff(dayjs(event.start), 'millisecond');
                const newStart = newDate;
                const newEnd = new Date(newStart.getTime() + duration);

                setEvents(prev => prev.map(e => {
                    const match = e.originalEvent?.id === event.originalEvent?.id && (!e.start || new Date(e.start).getTime() === new Date(event.start).getTime());
                    if (match) return { ...e, start: newStart, end: newEnd };
                    return e;
                }));

                const rawIds = event.originalEvent?.ids || [event.originalEvent?.id];
                const ids = rawIds.filter((id: any) => id && (rawIds.length === 1 || String(id) !== String(event.originalEvent?.calendarId)));

                const executeUpdate = async (options: any = {}) => {
                    const isAndroid = Platform.OS === 'android';
                    for (const id of ids) {
                        try {
                            const originalId = event.originalEvent?.originalId || String(id).split(':')[0];
                            const isSeriesUpdate = options.editScope === 'all' || options.editScope === 'future';
                            let targetId = (isSeriesUpdate && originalId) ? originalId : id;
                            if (isAndroid && options.editScope === 'future' && String(targetId).includes(':')) targetId = String(targetId).split(':')[0];

                            await updateCalendarEvent(targetId, {
                                startDate: newStart,
                                endDate: newEnd,
                                title: event.title || event.originalEvent?.title || 'Event',
                                calendarId: event.originalEvent?.calendarId,
                                ...options
                            });
                        } catch (err) {
                            console.warn(`[ScheduleScreen] Failed to update event ID ${id}:`, err);
                        }
                    }
                    setTimeout(() => fetchEvents(), 500);
                };

                const isRecurrent = event.isRecurrent || !!event.originalEvent?.recurrenceRule || !!event.originalEvent?.originalId || !!event.originalEvent?.instanceStartDate;
                if (isRecurrent) {
                    setPendingEventDrop({ event, newDate, executeUpdate: (opts: any) => executeUpdate({ ...opts, instanceStartDate: new Date(event.start) }) });
                    setRecurrenceModalVisible(true);
                } else {
                    executeUpdate();
                }
            } catch (e) {
                console.error('[ScheduleScreen] Error in handleEventDrop Personal Path', e);
                showError("Error", 'Failed to reschedule event.');
                fetchEvents();
            }
        }
    };

    const handleToggleCompleted = async (title: string, dateStr: string) => {
        toggleCompleted(title, dateStr);
        const event = events.find(e => {
            const eDateStr = dayjs(e.start).format('YYYY-MM-DD');
            return e.title === title && eDateStr === dateStr;
        });

        if (event) {
            const eventId = event.originalEvent?.id || event.id;
            const allIds = event.originalEvent?.ids || [eventId];
            let relations = null;
            let foundEventId = eventId;

            for (const id of allIds) {
                const data = useRelationsStore.getState().relations[id];
                if (data && data.tasks.length > 0) {
                    relations = data;
                    foundEventId = id;
                    break;
                }
            }

            if (relations && relations.tasks.length === 1 && relations.notes.length === 0) {
                const relTask = relations.tasks[0];
                const taskEventIds = relTask.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
                if (taskEventIds.length > 0) {
                    const { tasks } = useTasksStore.getState();
                    const liveTask = tasks.find(t => {
                        const tIds = t.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
                        return tIds.some(id => allIds.includes(id));
                    });

                    const task = liveTask || relTask;
                    const wasCompleted = !!completedEvents[`${title}::${dateStr}`];
                    const isNowCompleted = !wasCompleted;
                    const newStatus = isNowCompleted ? 'x' : ' ';

                    if (task.status !== newStatus) {
                        if (vaultUri) {
                            const newTask = { ...task, status: newStatus, completed: newStatus === 'x' };
                            await TaskService.syncTaskUpdate(vaultUri, task, newTask);
                            const { tasks, setTasks } = useTasksStore.getState();
                            const updatedTasks = tasks.map(t => (t.filePath === task.filePath && t.originalLine === task.originalLine) ? newTask : t);
                            setTasks(updatedTasks);
                            useRelationsStore.getState().updateTask(task, newTask as any);
                        }
                    }
                }
            }
        }
    };

    return {
        handleDeleteEvent,
        handleSaveEvent,
        handleEventDrop,
        handleToggleCompleted
    };
};
