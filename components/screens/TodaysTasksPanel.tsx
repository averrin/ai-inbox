import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UniversalIcon } from '../ui/UniversalIcon';
import { ActionButton } from '../ui/ActionButton';
import Toast from 'react-native-toast-message';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useTasksStore, TaskWithSource } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
import { useEventTypesStore } from '../../store/eventTypes';
import { useRelationsStore } from '../../store/relations';
import { DraggableTaskItem } from '../DraggableTaskItem';
import { RichTask } from '../../utils/taskParser';
import { TaskService } from '../../services/taskService';
import { findNextFreeSlot, updateCalendarEvent, deleteCalendarEvent } from '../../services/calendarService';
import { RescheduleModal } from '../RescheduleModal';
import { useNow } from '../ui/calendar/hooks/useNow';
import { Colors } from '../ui/design-tokens';
import { MetadataChip } from '../ui/MetadataChip';
import { showError } from '../../utils/alert';

dayjs.extend(isBetween);

if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TodaysTasksPanelProps {
    date: Date;
    events: any[]; // Calendar events
    onAdd: () => void;
    onEditTask?: (task: TaskWithSource) => void;
    onRefresh?: () => void;
}

const PRIORITY_ORDER: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
    none: 0,
};

export const TodaysTasksPanel = ({ date, events: calendarEvents, onAdd, onEditTask, onRefresh }: TodaysTasksPanelProps) => {
    const { tasks, setTasks } = useTasksStore();
    const { vaultUri } = useSettingsStore();
    const { completedEvents, toggleCompleted, assignments, eventTypes, eventIcons } = useEventTypesStore();
    const { now } = useNow(true);
    const [expanded, setExpanded] = useState(true);

    // Reschedule Modal State
    const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
    const [taskToReschedule, setTaskToReschedule] = useState<(TaskWithSource | any) & { _type?: 'task' | 'event' } | null>(null);

    const toggleExpanded = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const displayItems = useMemo(() => {
        const targetDateStr = dayjs(date).format('YYYY-MM-DD');
        const todayStr = dayjs().format('YYYY-MM-DD');

        // 1. Filter Tasks
        const eventIds = new Set<string>();
        calendarEvents.forEach(e => {
            if (dayjs(e.start).isSame(dayjs(date), 'day')) {
                if (e.originalEvent?.id) eventIds.add(e.originalEvent.id);
                if (e.id) eventIds.add(e.id);
            }
        });

        const filteredTasks = tasks.filter(task => {
            if (task.completed) return false;
            const props = task.properties;
            if (props.date === targetDateStr) return true;
            if (props.start && props.due && dayjs(targetDateStr).isBetween(props.start, props.due, 'day', '[]')) return true;
            if (targetDateStr === todayStr && props.due && dayjs(props.due).isBefore(todayStr, 'day')) return true;
            if (props.event_id && props.event_id.split(',').some((id: string) => eventIds.has(id.trim()))) return true;
            return false;
        }).map(t => ({ type: 'task' as const, data: t }));

        // 2. Filter Events for "Today" panel
        // We only want "Real" events, not zones/markers that might be passed in
        const filteredEvents = calendarEvents.filter(e => {
            const isMarker = e.type === 'marker';
            const isZone = e.type === 'zone';
            if (isMarker || isZone) return false;

            // Only show events with the "checkbox" trait
            if (!e.completable) return false;

            // Do not show completed events
            const eventDateStr = dayjs(e.start).format('YYYY-MM-DD');
            const key = `${e.title}::${eventDateStr}`;
            if (completedEvents[key]) return false;

            // Ensure it's for the selected date
            return dayjs(e.start).isSame(dayjs(date), 'day');
        }).map(e => ({ type: 'event' as const, data: e }));

        // 3. De-duplicate: Keep tasks, hide event if linked task is visible
        // We match by ID (exact link) OR by Title (fuzzy link for multi-calendar duplicates)
        const linkedEventIdsInTasks = new Set<string>();
        const linkedEventTitlesInTasks = new Set<string>();

        filteredTasks.forEach(t => {
            if (t.data.properties.event_id) {
                t.data.properties.event_id.split(',').forEach((id: string) => linkedEventIdsInTasks.add(id.trim()));
            }
            if (t.data.properties.event_title) {
                linkedEventTitlesInTasks.add(t.data.properties.event_title.trim());
            }
        });


        const dedupedEvents = filteredEvents.filter(e => {
            const eventId = e.data.originalEvent?.id || e.data.id;
            const eventTitle = e.data.title?.trim();

            const idMatch = linkedEventIdsInTasks.has(eventId);
            const titleMatch = eventTitle && linkedEventTitlesInTasks.has(eventTitle);

            const shouldHide = idMatch || titleMatch;

            return !shouldHide;
        });

        // Combine and Sort
        return [...dedupedEvents, ...filteredTasks];
    }, [tasks, date, calendarEvents, completedEvents]);

    const tasksCount = displayItems.filter(i => i.type === 'task').length;
    const eventsCount = displayItems.filter(i => i.type === 'event').length;

    const remindersCount = useMemo(() => {
        return calendarEvents.filter(e => e.type === 'marker' && dayjs(e.start).isSame(dayjs(date), 'day')).length;
    }, [calendarEvents, date]);

    const handleTaskUpdate = async (original: TaskWithSource, updated: RichTask) => {
        if (!vaultUri) return;
        try {
            await TaskService.syncTaskUpdate(vaultUri, original, updated);
            const newTasks = tasks.map(t =>
                (t.filePath === original.filePath && t.originalLine === original.originalLine)
                    ? { ...t, ...updated }
                    : t
            );
            setTasks(newTasks);
        } catch (e: any) {
            console.error("Failed to update task", e);
            if (e.message === 'FILE_NOT_FOUND') {
                const newTasks = tasks.filter(t =>
                    !(t.filePath === original.filePath && t.originalLine === original.originalLine)
                );
                setTasks(newTasks);
                Toast.show({ type: 'error', text1: 'Task file missing', text2: 'Removed orphan task.' });
            } else {
                showError("Error", "Failed to update task");
            }
        }
    };

    const handleToggleTask = (task: TaskWithSource) => {
        console.log('[TodaysTasksPanel] Toggling task:', task.title, task.status);
        const newStatus = task.status === ' ' ? 'x' : ' ';
        const newTask = { ...task, status: newStatus, completed: newStatus === 'x' };
        handleTaskUpdate(task, newTask);

        // Update Relations Store to keep it in sync
        useRelationsStore.getState().updateTask(task, newTask as TaskWithSource);

        // Sync with Event (1-1 only)
        const eventIds = task.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
        console.log('[TodaysTasksPanel] Task event_ids:', eventIds);

        if (eventIds.length > 0) {
            const eventId = eventIds[0]; // Use first ID as representative for title/date sync
            const relations = useRelationsStore.getState().relations[eventId];
            console.log('[TodaysTasksPanel] Relations for event', eventId, relations);

            if (relations && relations.tasks.length === 1 && relations.notes.length === 0) {
                const eventDateStr = task.properties['date'] || dayjs(date).format('YYYY-MM-DD');
                const eventTitle = task.properties['event_title'];

                if (eventTitle) {
                    const isEventDone = !!completedEvents[`${eventTitle}::${eventDateStr}`];
                    const shouldBeDone = newStatus === 'x';

                    console.log('[TodaysTasksPanel] Sync check:', { isEventDone, shouldBeDone });

                    if (isEventDone !== shouldBeDone) {
                        console.log('[TodaysTasksPanel] Syncing to event:', eventTitle);
                        toggleCompleted(eventTitle, eventDateStr);
                    }
                }
            } else {
                console.log('[TodaysTasksPanel] Not unique 1-1 relation for event ID, skipping sync');
            }
        }
    };

    const handleToggleEvent = (event: any) => {
        console.log('[TodaysTasksPanel] Toggling event:', event.title);
        const dateStr = dayjs(event.start).format('YYYY-MM-DD');
        toggleCompleted(event.title, dateStr);

        // Sync with Task (1-1 only)
        const eventId = event.originalEvent?.id || event.id;
        const relations = useRelationsStore.getState().relations[eventId];
        console.log('[TodaysTasksPanel] Relations lookup for event', eventId, relations);

        if (relations && relations.tasks.length === 1 && relations.notes.length === 0) {
            const task = relations.tasks[0];
            const taskEventIds = task.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
            console.log('[TodaysTasksPanel] Task has event_ids:', taskEventIds);

            if (taskEventIds.length > 0) {
                const isCheckingEvent = !isEventCompleted(event);
                const newStatus = isCheckingEvent ? 'x' : ' ';

                console.log('[TodaysTasksPanel] Syncing to task status:', newStatus);

                if (task.status !== newStatus) {
                    handleToggleTask(task);
                }
            }
        } else {
            console.log('[TodaysTasksPanel] No unique task relation found');
        }
    };

    const isEventCompleted = (event: any) => {
        const dateStr = dayjs(event.start).format('YYYY-MM-DD');
        const key = `${event.title}::${dateStr}`;
        return !!completedEvents[key];
    };

    const handleSkipEvent = async (event: any) => {
        try {
            const isRecurring = !!event.originalEvent?.recurrenceRule || !!event.originalEvent?.instanceStartDate;
            const options = isRecurring ? { instanceStartDate: event.start } : undefined;
            const eventId = event.originalEvent?.id || event.id;

            await deleteCalendarEvent(eventId, options);

            Toast.show({ type: 'success', text1: 'Skipped', text2: 'Event removed from today.' });
            if (onRefresh) onRefresh();
        } catch (e) {
            console.error("Failed to skip event:", e);
            showError("Error", "Failed to skip event");
        }
    };

    const handleReschedule = (item: TaskWithSource | any, type: 'task' | 'event') => {
        setTaskToReschedule({ ...item, _type: type });
        setRescheduleModalVisible(true);
    };

    const executeReschedule = async (option: 'later' | 'tomorrow') => {
        if (!taskToReschedule) return;
        const item = taskToReschedule;
        setRescheduleModalVisible(false);

        const isTask = item._type === 'task';
        const hasEvent = isTask ? !!item.properties.event_id : true;

        try {
            const now = dayjs();
            const currentStart = isTask ? (item.properties.date ? dayjs(item.properties.date) : now) : dayjs(item.start);

            // 1. Determine Search Start Time
            let searchStart: Date;

            if (option === 'later') {
                // Later (Today): Find a slot later today
                if (currentStart.isBefore(now, 'day') || currentStart.isSame(now, 'day')) {
                    searchStart = now.add(30, 'minute').toDate();
                } else {
                    // Future date -> start from same time + 30m? Or just start of day?
                    // If "Later" on a future task, assume later in that day
                    searchStart = currentStart.hour(now.hour()).minute(now.minute()).add(30, 'minute').toDate();
                }
            } else {
                // Tomorrow: Find a slot tomorrow morning
                let targetDate = currentStart.add(1, 'day');
                if (currentStart.isBefore(now, 'day')) {
                    targetDate = now.add(1, 'day'); // Tomorrow relative to today
                }
                searchStart = targetDate.hour(9).minute(0).second(0).toDate();
            }

            if (isTask) {
                const task = item as TaskWithSource;
                // 2. Logic Branching for Tasks
                if (!hasEvent) {
                    // --- NO EVENT: Only update DATE ---
                    if (option === 'tomorrow') {
                        const newDate = dayjs(searchStart).format('YYYY-MM-DD');
                        const newProps = { ...task.properties, date: newDate };

                        handleTaskUpdate(task, { ...task, properties: newProps });
                        Toast.show({ type: 'success', text1: 'Rescheduled', text2: `Moved to ${newDate}` });
                    } else {
                        console.warn("Attempted 'later' reschedule on task without event");
                    }
                } else {
                    // --- HAS EVENT: Move Event & Update Task Date ---

                    // Calculate Duration
                    let durationMins = 30;
                    if (task.properties.start && task.properties.end) {
                        const s = dayjs(`2000-01-01T${task.properties.start}`);
                        const e = dayjs(`2000-01-01T${task.properties.end}`);
                        if (s.isValid() && e.isValid()) {
                            const diff = e.diff(s, 'minute');
                            if (diff > 0) durationMins = Math.max(diff, 30);
                        }
                    }

                    // Find Slot
                    const slot = await findNextFreeSlot(searchStart, durationMins);
                    const slotEnd = dayjs(slot).add(durationMins, 'minute').toDate();

                    // Update Calendar Event(s)
                    const eventIds = (task.properties.event_id || '').split(',').map(id => id.trim()).filter(Boolean);
                    if (eventIds.length > 0) {
                        await Promise.all(eventIds.map(async (eventId) => {
                            try {
                                await updateCalendarEvent(eventId, {
                                    startDate: slot,
                                    endDate: slotEnd
                                });
                            } catch (err) {
                                console.error(`[TodaysTasksPanel] Failed to update calendar event ${eventId}:`, err);
                            }
                        }));
                        if (onRefresh) {
                            setTimeout(() => onRefresh(), 500);
                        }
                    }

                    // Update Task Date (Sync)
                    const newDate = dayjs(slot).format('YYYY-MM-DD');
                    const newProps = { ...task.properties, date: newDate };

                    handleTaskUpdate(task, { ...task, properties: newProps });
                    Toast.show({
                        type: 'success',
                        text1: 'Rescheduled',
                        text2: `Moved to ${newDate} at ${dayjs(slot).format('HH:mm')}`
                    });
                }
            } else {
                // Event Logic
                const durationMins = dayjs(item.end).diff(dayjs(item.start), 'minute') || 30;
                const slot = await findNextFreeSlot(searchStart, durationMins);
                const slotEnd = dayjs(slot).add(durationMins, 'minute').toDate();

                const eventId = item.originalEvent?.id || item.id;

                await updateCalendarEvent(eventId, {
                    title: item.title,
                    startDate: slot,
                    endDate: slotEnd,
                    editScope: 'this', // Always move just this instance for reschedule
                    instanceStartDate: item.start // Required for identifying instance
                });

                if (onRefresh) {
                    setTimeout(() => onRefresh(), 500);
                }
                Toast.show({ type: 'success', text1: 'Rescheduled', text2: `Moved to ${dayjs(slot).format('MMM D HH:mm')}` });
            }

        } catch (e) {
            console.error('Reschedule failed', e);
            showError("Error", "Failed to reschedule task/event");
        }
    };

    return (
        <View className="mt-2">
            <TouchableOpacity
                onPress={toggleExpanded}
                className="flex-row items-center justify-between p-3 bg-surface/50 mx-4 rounded-xl border border-border"
            >
                <View className="flex-row items-center gap-2">
                    <Ionicons name="checkbox-outline" size={18} color="#818cf8" />
                    <Text className="text-text-primary font-semibold text-sm">
                        Focus for {dayjs(date).format('MMM D')}
                    </Text>

                    <View className="flex-row items-center gap-1.5 ml-1">
                        {tasksCount > 0 && (
                            <MetadataChip
                                icon="checkbox-outline"
                                label={String(tasksCount)}
                                size="sm"
                                color={Colors.primary}
                                variant="solid"
                                rounding="full"
                            />
                        )}
                        {eventsCount > 0 && (
                            <MetadataChip
                                icon="calendar-outline"
                                label={String(eventsCount)}
                                size="sm"
                                color={Colors.info}
                                variant="solid"
                                rounding="full"
                            />
                        )}
                        {remindersCount > 0 && (
                            <MetadataChip
                                icon="notifications-outline"
                                label={String(remindersCount)}
                                size="sm"
                                color={Colors.warning}
                                variant="solid"
                                rounding="full"
                            />
                        )}
                    </View>
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); onAdd(); }}>
                        <Ionicons name="add" size={20} color="#818cf8" />
                    </TouchableOpacity>
                    <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={Colors.secondary} />
                </View>
            </TouchableOpacity>

            {expanded && (
                <View className="mx-4 mt-2 gap-1">
                    {displayItems.length === 0 ? (
                        <View className="p-4 items-center justify-center border border-dashed border-border rounded-lg">
                            <Text className="text-secondary text-xs italic">Nothing for today</Text>
                            <TouchableOpacity onPress={onAdd} className="mt-2">
                                <Text className="text-primary text-xs font-medium">Add a task</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        displayItems.map((item: any, index: number) => {
                            // Calculate isHighlighted (Now or Overdue)
                            let isHighlighted = false;
                            let highlightColor = '#818cf8'; // Default indigo
                            let isCompleted = false;

                            if (item.type === 'event') {
                                isCompleted = isEventCompleted(item.data);
                                const start = dayjs(item.data.start);
                                const end = dayjs(item.data.end);
                                const isFinishedToday = dayjs(now).isSame(start, 'day') && dayjs(now).isAfter(end);
                                const isNow = dayjs(now).isBetween(start, end, null, '[)');
                                const isOverdue = item.data.completable && !isCompleted && isFinishedToday;

                                if (isOverdue) {
                                    isHighlighted = true;
                                    highlightColor = Colors.error;
                                } else if (isNow) {
                                    isHighlighted = true;
                                    highlightColor = item.data.color || highlightColor;
                                }
                            } else {
                                // Task
                                isCompleted = item.data.status === 'x';
                                // Task: Check all linked events
                                const taskEventIds = item.data.properties.event_id?.split(',').map((id: string) => id.trim()).filter(Boolean) || [];
                                const taskEventTitle = item.data.properties.event_title;

                                for (const taskEventId of taskEventIds) {
                                    const linkedEvent = calendarEvents.find(e => {
                                        const ids = (e as any).ids || [e.originalEvent?.id || e.id].filter(Boolean);
                                        return ids.includes(taskEventId) || (taskEventTitle && e.title === taskEventTitle);
                                    });

                                    if (linkedEvent) {
                                        const start = dayjs(linkedEvent.start);
                                        const end = dayjs(linkedEvent.end);
                                        const isFinishedToday = dayjs(now).isSame(start, 'day') && dayjs(now).isAfter(end);
                                        const eventIsNow = dayjs(now).isBetween(start, end, null, '[)');
                                        // Tasks are inherently completable, so we don't check linkedEvent.completable
                                        const eventIsOverdue = !isCompleted && isFinishedToday;

                                        if (eventIsOverdue) {
                                            isHighlighted = true;
                                            highlightColor = Colors.error;
                                            break; // Red glow wins
                                        } else if (eventIsNow) {
                                            isHighlighted = true;
                                            highlightColor = linkedEvent.color || highlightColor;
                                        }
                                    }
                                }
                            }

                            if (item.type === 'task') {
                                return (
                                    <View key={`${item.data.filePath}-${index}`} style={{ overflow: 'visible' }}>
                                        <DraggableTaskItem
                                            task={item.data}
                                            fileName={item.data.fileName}
                                            onToggle={() => handleToggleTask(item.data)}
                                            onUpdate={(updated) => handleTaskUpdate(item.data, updated)}
                                            onEdit={() => onEditTask?.(item.data)}
                                            onReschedule={() => handleReschedule(item.data, 'task')}
                                            isHighlighted={isHighlighted}
                                            highlightColor={highlightColor}
                                        />
                                    </View>
                                );
                            } else {
                                const highlightStyle = isHighlighted ? {
                                    borderWidth: 2,
                                    borderColor: highlightColor,
                                    // backgroundColor: Colors.transparent,
                                    shadowColor: highlightColor,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.9,
                                    shadowRadius: 20,
                                } : {};

                                // Determine Type & Icon
                                const title = item.data.title;
                                const typeId = assignments[title];
                                const eventType = typeId ? eventTypes.find(t => t.id === typeId) : null;
                                const typeName = eventType?.title || 'Event';
                                const iconName = eventIcons[title] || eventType?.icon || 'calendar-outline';

                                return (
                                    <View key={`event-wrap-${index}`}>
                                        <TouchableOpacity
                                            key={`event-${index}`}
                                            className={`mb-2 flex-row items-center p-3 bg-surface/30 rounded-xl border border-border ${isCompleted ? 'opacity-40' : ''}`}
                                            style={highlightStyle}
                                            onPress={() => handleToggleEvent(item.data)}
                                        >
                                            <View className={`w-5 h-5 rounded border items-center justify-center mr-3 ${isCompleted ? 'bg-primary border-primary' : 'border-border'}`}>
                                                {isCompleted && <Ionicons name="checkmark" size={14} color="white" />}
                                            </View>
                                            <View className="flex-1">
                                                <Text className={`text-sm font-medium ${isCompleted ? 'text-secondary line-through' : 'text-text-primary'}`}>
                                                    {item.data.title}
                                                </Text>
                                                <View className="flex-row items-center gap-2 mt-0.5">
                                                    <Text className="text-[10px] text-secondary">
                                                        {dayjs(item.data.start).format('HH:mm')} - {dayjs(item.data.end).format('HH:mm')}
                                                    </Text>
                                                    <View className="w-1 h-1 rounded-full bg-surface-highlight" />
                                                    <Text className="text-[10px] text-primary font-bold uppercase tracking-tighter">{typeName}</Text>
                                                </View>
                                            </View>
                                            <UniversalIcon name={iconName} size={14} color="#475569" />

                                            <View className="flex-row items-center gap-1 ml-2">
                                                <ActionButton
                                                    onPress={(e: any) => { e?.stopPropagation(); handleReschedule(item.data, 'event'); }}
                                                    icon="time-outline"
                                                    variant="neutral"
                                                    size={16}
                                                />
                                                <ActionButton
                                                    onPress={(e: any) => { e?.stopPropagation(); handleSkipEvent(item.data); }}
                                                    icon="close-circle-outline"
                                                    variant="neutral"
                                                    size={16}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            }
                        })
                    )}

                    <RescheduleModal
                        visible={rescheduleModalVisible}
                        onClose={() => setRescheduleModalVisible(false)}
                        onSelect={executeReschedule}
                        showLater={taskToReschedule?._type === 'event' || !!taskToReschedule?.properties?.event_id}
                    />
                </View>
            )}
        </View>
    );
};
