import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export const TodaysTasksPanel = ({ date, events: calendarEvents, onAdd, onEditTask }: TodaysTasksPanelProps) => {
  const { tasks, setTasks } = useTasksStore();
  const { vaultUri } = useSettingsStore();
  const { completedEvents, toggleCompleted } = useEventTypesStore();
  const [expanded, setExpanded] = useState(true);

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
        if (e.originalEvent?.id) eventIds.add(e.originalEvent.id);
        if (e.id) eventIds.add(e.id);
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

    console.log('[TodaysTasksPanel] linked ids:', Array.from(linkedEventIdsInTasks));
    console.log('[TodaysTasksPanel] linked titles:', Array.from(linkedEventTitlesInTasks));

    const dedupedEvents = filteredEvents.filter(e => {
      const eventId = e.data.originalEvent?.id || e.data.id;
      const eventTitle = e.data.title?.trim();
      
      const idMatch = linkedEventIdsInTasks.has(eventId);
      const titleMatch = eventTitle && linkedEventTitlesInTasks.has(eventTitle);
      
      const shouldHide = idMatch || titleMatch;
      
      if (shouldHide) {
          console.log('[TodaysTasksPanel] Hiding event:', eventTitle, eventId, idMatch ? '[ID]' : '[TITLE]');
      } else {
           console.log('[TodaysTasksPanel] Showing event:', eventTitle, eventId);
      }
      return !shouldHide;
    });

    // Combine and Sort
    return [...dedupedEvents, ...filteredTasks];
  }, [tasks, date, calendarEvents, completedEvents]);

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
            Alert.alert("Error", "Failed to update task");
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
      
      if (eventIds.length === 1) {
          const eventId = eventIds[0];
          const relations = useRelationsStore.getState().relations[eventId];
          console.log('[TodaysTasksPanel] Relations for event', eventId, relations);
          
          if (relations && relations.tasks.length === 1 && relations.notes.length === 0) {
              const eventDateStr = task.properties['date'] || dayjs(date).format('YYYY-MM-DD');
              const isEventDone = !!completedEvents[`${task.properties['event_title']}::${eventDateStr}`];
              const shouldBeDone = newStatus === 'x';
              
              console.log('[TodaysTasksPanel] Sync check:', { isEventDone, shouldBeDone });
              
              if (isEventDone !== shouldBeDone) {
                  console.log('[TodaysTasksPanel] Syncing to event:', task.properties['event_title']);
                  toggleCompleted(task.properties['event_title'], eventDateStr);
              }
          } else {
              console.log('[TodaysTasksPanel] Not 1-1 relation, skipping sync');
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
          
          if (taskEventIds.length === 1) {
              const isCheckingEvent = !isEventCompleted(event);
              const newStatus = isCheckingEvent ? 'x' : ' ';
              
              console.log('[TodaysTasksPanel] Syncing to task status:', newStatus);
              
              if (task.status !== newStatus) {
                  // We need to pass the task from relation store, which we have as 'task'
                  // But we need to make sure handleToggleTask uses the correct object reference?
                  // handleToggleTask uses task.properties... 
                  // It should be fine.
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

  return (
    <View className="mx-4 mt-2 mb-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <TouchableOpacity
        onPress={toggleExpanded}
        className="flex-row items-center justify-between p-3 bg-slate-800/50"
      >
        <View className="flex-row items-center gap-2">
            <Ionicons name="checkbox-outline" size={18} color="#818cf8" />
            <Text className="text-slate-200 font-semibold text-sm">
                Focus for {dayjs(date).format('MMM D')}
            </Text>
            {displayItems.length > 0 && (
                <View className="bg-indigo-500/20 px-1.5 py-0.5 rounded">
                    <Text className="text-indigo-400 text-[10px] font-bold">{displayItems.length}</Text>
                </View>
            )}
        </View>
        <View className="flex-row items-center gap-3">
             <TouchableOpacity onPress={(e) => { e.stopPropagation(); onAdd(); }}>
                <Ionicons name="add" size={20} color="#818cf8" />
             </TouchableOpacity>
             <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="p-2 gap-2">
            {displayItems.length === 0 ? (
                <View className="p-4 items-center justify-center border border-dashed border-slate-700 rounded-lg">
                    <Text className="text-slate-500 text-xs italic">Nothing for today</Text>
                    <TouchableOpacity onPress={onAdd} className="mt-2">
                        <Text className="text-indigo-400 text-xs font-medium">Add a task</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                displayItems.map((item, index) => {
                    if (item.type === 'task') {
                        return (
                            <DraggableTaskItem
                                key={`${item.data.filePath}-${index}`}
                                task={item.data}
                                fileName={item.data.fileName}
                                onToggle={() => handleToggleTask(item.data)}
                                onUpdate={(updated) => handleTaskUpdate(item.data, updated)}
                                onEdit={() => onEditTask?.(item.data)}
                            />
                        );
                    } else {
                        const completed = isEventCompleted(item.data);
                        return (
                            <TouchableOpacity 
                                key={`event-${index}`}
                                className={`flex-row items-center p-3 bg-slate-800/30 rounded-lg border border-slate-800/50 ${completed ? 'opacity-40' : ''}`}
                                onPress={() => handleToggleEvent(item.data)}
                            >
                                <View className={`w-5 h-5 rounded border items-center justify-center mr-3 ${completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
                                    {completed && <Ionicons name="checkmark" size={14} color="white" />}
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-sm font-medium ${completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                        {item.data.title}
                                    </Text>
                                    <View className="flex-row items-center gap-2 mt-0.5">
                                        <Text className="text-[10px] text-slate-500">
                                            {dayjs(item.data.start).format('HH:mm')} - {dayjs(item.data.end).format('HH:mm')}
                                        </Text>
                                        <View className="w-1 h-1 rounded-full bg-slate-700" />
                                        <Text className="text-[10px] text-indigo-400/80 font-bold uppercase tracking-tighter">Event</Text>
                                    </View>
                                </View>
                                <Ionicons name="calendar-outline" size={14} color="#475569" />
                            </TouchableOpacity>
                        );
                    }
                })
            )}
        </View>
      )}
    </View>
  );
};
