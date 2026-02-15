import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useTasksStore, TaskWithSource } from '../../store/tasks';
import { useSettingsStore } from '../../store/settings';
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
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export const TodaysTasksPanel = ({ date, events, onAdd }: TodaysTasksPanelProps) => {
  const { tasks, setTasks } = useTasksStore();
  const { vaultUri } = useSettingsStore();
  const [expanded, setExpanded] = useState(true);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const todaysTasks = useMemo(() => {
    const targetDateStr = dayjs(date).format('YYYY-MM-DD');
    const todayStr = dayjs().format('YYYY-MM-DD'); // "Today" in real time for overdue check

    // Get event IDs for current day
    const eventIds = new Set<string>();
    events.forEach(e => {
        if (e.originalEvent?.id) eventIds.add(e.originalEvent.id);
        if (e.id) eventIds.add(e.id);
    });

    return tasks.filter(task => {
        if (task.completed) return false;

        const props = task.properties;
        const taskDate = props.date;
        const taskStart = props.start;
        const taskDue = props.due;
        const eventIdStr = props.event_id;

        // 1. Exact Date Match
        if (taskDate === targetDateStr) return true;

        // 2. Start-Due Range Match
        if (taskStart && taskDue) {
            // Is targetDate within [start, due]?
            if (dayjs(targetDateStr).isBetween(taskStart, taskDue, 'day', '[]')) return true;
        }

        // 3. Overdue (Due < Today's Real Date) - Only show if we are looking at today or past?
        // Requirement: "And overdue tasks."
        // Usually overdue tasks are shown on "Today" view.
        // If I'm looking at tomorrow, should I show overdue tasks? Probably not, unless they are rescheduled.
        // Let's assume "Today's Tasks" implies tasks relevant to the *selected* date.
        // If selected date is Today, show overdue.
        if (targetDateStr === todayStr && taskDue && dayjs(taskDue).isBefore(todayStr, 'day')) {
            return true;
        }

        // 4. Linked to Day's Events
        if (eventIdStr) {
            const ids = eventIdStr.split(',').map(s => s.trim());
            if (ids.some(id => eventIds.has(id))) return true;
        }

        return false;
    }).sort((a, b) => {
        // Sort by Priority
        const pA = PRIORITY_ORDER[a.properties.priority || 'none'] || 0;
        const pB = PRIORITY_ORDER[b.properties.priority || 'none'] || 0;
        if (pA !== pB) return pB - pA; // Descending

        // Then by Due Date (earlier first)
        if (a.properties.due && b.properties.due) return a.properties.due.localeCompare(b.properties.due);
        if (a.properties.due) return -1;
        if (b.properties.due) return 1;

        return 0;
    }).slice(0, 5); // Limit 5
  }, [tasks, date, events]);

  const handleTaskUpdate = async (original: TaskWithSource, updated: RichTask) => {
    if (!vaultUri) return;
    try {
        await TaskService.syncTaskUpdate(vaultUri, original, updated);
        // Store update is handled via file watcher usually, but we can optimistically update
        // Actually TaskService.syncTaskUpdate might trigger reload or we might need to update store manually
        // For now, let's assume store reloads or we do nothing (optimistic update is tricky with file sync)
        // But we can update local state in store for immediate feedback
        const newTasks = tasks.map(t =>
            (t.filePath === original.filePath && t.originalLine === original.originalLine)
            ? { ...t, ...updated }
            : t
        );
        setTasks(newTasks);
    } catch (e) {
        console.error("Failed to update task", e);
    }
  };

  const handleToggle = (task: TaskWithSource) => {
      const newStatus = task.status === ' ' ? 'x' : ' ';
      handleTaskUpdate(task, { ...task, status: newStatus, completed: newStatus === 'x' });
  };

  if (todaysTasks.length === 0 && !expanded) return null; // Hide if empty and collapsed? Or show "No tasks"

  return (
    <View className="mx-4 mt-2 mb-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
      <TouchableOpacity
        onPress={toggleExpanded}
        className="flex-row items-center justify-between p-3 bg-slate-800/50"
      >
        <View className="flex-row items-center gap-2">
            <Ionicons name="checkbox-outline" size={18} color="#818cf8" />
            <Text className="text-slate-200 font-semibold text-sm">
                Tasks for {dayjs(date).format('MMM D')}
            </Text>
            {todaysTasks.length > 0 && (
                <View className="bg-indigo-500/20 px-1.5 py-0.5 rounded">
                    <Text className="text-indigo-400 text-[10px] font-bold">{todaysTasks.length}</Text>
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
            {todaysTasks.length === 0 ? (
                <View className="p-4 items-center justify-center border border-dashed border-slate-700 rounded-lg">
                    <Text className="text-slate-500 text-xs italic">No tasks for today</Text>
                    <TouchableOpacity onPress={onAdd} className="mt-2">
                        <Text className="text-indigo-400 text-xs font-medium">Add a task</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                todaysTasks.map((task, index) => (
                    <DraggableTaskItem
                        key={`${task.filePath}-${index}`} // Use a stable key if possible
                        task={task}
                        fileName={task.fileName}
                        onToggle={() => handleToggle(task)}
                        onUpdate={(updated) => handleTaskUpdate(task, updated)}
                        onEdit={() => { /* Open edit modal? We need to pass onEdit to parent or handle it */ }}
                    />
                ))
            )}
        </View>
      )}
    </View>
  );
};
