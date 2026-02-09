
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Switch, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { getCalendarEvents } from '../services/calendarService';
import { rescheduleReminderWithAI, AIRescheduleContext } from '../services/gemini';
import dayjs from 'dayjs';
import { RecurrenceScopeModal } from './RecurrenceScopeModal';
import { useTasksStore, TaskWithSource } from '../store/tasks';

export interface EventSaveData {
    type: 'event' | 'reminder' | 'alarm';
    title: string;
    startDate: Date;
    endDate: Date;
    allDay: boolean;
    isWork: boolean;
    recurrenceRule?: {
        frequency: string; // 'daily', 'weekly', 'monthly', 'yearly'
        interval?: number;
        endDate?: Date;
        occurrence?: number;
    } | null;
    editScope?: 'this' | 'future' | 'all';
    alarm?: boolean;
    persistent?: number;
}

export interface DeleteOptions {
    scope?: 'this' | 'future' | 'all';
    deleteFile?: boolean;
}

interface EventFormModalProps {
    visible: boolean;
    initialDate?: Date;
    initialEvent?: any; // Calendar event object for editing
    initialType?: 'event' | 'reminder' | 'alarm';
    onSave: (data: EventSaveData) => void;
    onDelete?: (options: DeleteOptions) => void;
    onCancel: () => void;
    onOpenTask?: (task: TaskWithSource) => void;
    timeFormat: '12h' | '24h';
}

export function EventFormModal({
    visible,
    initialDate,
    initialEvent,
    initialType,
    onSave,
    onDelete,
    onCancel,
    onOpenTask,
    timeFormat
}: EventFormModalProps) {
    // Stores
    const { apiKey, visibleCalendarIds } = useSettingsStore();
    const { ranges } = useEventTypesStore();
    const { tasks } = useTasksStore();

    // State
    const [type, setType] = useState<'event' | 'reminder' | 'alarm'>('event');
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [allDay, setAllDay] = useState(false);
    const [isWork, setIsWork] = useState(false);
    const [recurrenceFreq, setRecurrenceFreq] = useState<string>('none'); // 'none', 'daily', 'weekly', 'monthly', 'yearly'
    const [recurrenceInterval, setRecurrenceInterval] = useState<string>('1');
    const [persistent, setPersistent] = useState<string>(''); // For Alarm

    // UI State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState<null | 'start' | 'end'>(null);
    const [showScopeSelector, setShowScopeSelector] = useState(false);
    const [scopeAction, setScopeAction] = useState<'save' | 'delete'>('save');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [isCustomDuration, setIsCustomDuration] = useState(false);

    // AI State
    const [isRescheduling, setIsRescheduling] = useState<null | 'later' | 'tomorrow'>(null);

    // Linked Items State
    const [linkedTasks, setLinkedTasks] = useState<TaskWithSource[]>([]);

    useEffect(() => {
        if (visible) {
            setShowScopeSelector(false);
            setScopeAction('save');
            setIsAdvancedOpen(false);

            // Determine Type
            let defaultType: 'event' | 'reminder' | 'alarm' = initialType || 'event';

            if (initialEvent) {
                if (initialEvent.typeTag === 'REMINDER' || initialEvent.originalEvent?.fileUri) {
                    defaultType = initialEvent.originalEvent?.alarm ? 'alarm' : 'reminder';
                }
            }
            setType(defaultType);

            if (initialEvent) {
                // Edit Mode
                setTitle(initialEvent.title || initialEvent.originalEvent?.title || '');
                const start = new Date(initialEvent.start || initialEvent.startDate || initialEvent.reminderTime);
                setStartDate(start);

                // End date handling
                const end = new Date(initialEvent.end || initialEvent.endDate || start.getTime() + 60*60000);
                const diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
                setDurationMinutes(diffMins > 0 ? diffMins : 60);

                setAllDay(initialEvent.allDay || false);
                setIsWork(initialEvent.isWork || false);

                // Recurrence
                // Check if it's a calendar recurrence object or a reminder string
                const rule = initialEvent.originalEvent?.recurrenceRule || initialEvent.recurrenceRule;
                if (rule) {
                    if (typeof rule === 'string') {
                        // Reminder string format: "daily", "weekly", "2 days"
                        const r = rule.toLowerCase().trim();
                        if (r === 'daily') { setRecurrenceFreq('daily'); setRecurrenceInterval('1'); }
                        else if (r === 'weekly') { setRecurrenceFreq('weekly'); setRecurrenceInterval('1'); }
                        else if (r === 'monthly') { setRecurrenceFreq('monthly'); setRecurrenceInterval('1'); }
                        else if (r === 'yearly') { setRecurrenceFreq('yearly'); setRecurrenceInterval('1'); }
                        else {
                            // Try to parse "2 days"
                            const parts = r.split(' ');
                            if (parts.length === 2 && !isNaN(parseInt(parts[0]))) {
                                setRecurrenceInterval(parts[0]);
                                if (parts[1].startsWith('day')) setRecurrenceFreq('daily');
                                else if (parts[1].startsWith('week')) setRecurrenceFreq('weekly');
                                else if (parts[1].startsWith('month')) setRecurrenceFreq('monthly');
                                else if (parts[1].startsWith('year')) setRecurrenceFreq('yearly');
                                else setRecurrenceFreq('none');
                            } else {
                                setRecurrenceFreq('none');
                            }
                        }
                    } else if (rule.frequency) {
                        // Calendar object format
                        setRecurrenceFreq(rule.frequency.toLowerCase());
                        setRecurrenceInterval(rule.interval ? rule.interval.toString() : '1');
                    }
                } else {
                    setRecurrenceFreq('none');
                    setRecurrenceInterval('1');
                }

                // Persistent (Reminder/Alarm)
                const p = initialEvent.originalEvent?.persistent;
                setPersistent(p ? p.toString() : '');

            } else {
                // Create Mode
                setStartDate(initialDate ? new Date(initialDate) : new Date());
                setTitle('');
                setDurationMinutes(60);
                setAllDay(false);
                setIsWork(false);
                setRecurrenceFreq('none');
                setRecurrenceInterval('1');
                setPersistent('');
                setIsCustomDuration(false);
            }
        }
    }, [visible, initialDate, initialEvent, initialType]);

    useEffect(() => {
        if (visible && initialEvent) {
            const eventId = initialEvent.id || initialEvent.originalEvent?.id;
            if (eventId) {
                const linked = tasks.filter(t => {
                    const linkedIds = t.properties['event_id']?.split(',').map((id: string) => id.trim()) || [];
                    return linkedIds.includes(eventId);
                });
                setLinkedTasks(linked);
            } else {
                setLinkedTasks([]);
            }
        } else {
            setLinkedTasks([]);
        }
    }, [visible, initialEvent, tasks]);

    // AI Logic
    const workRanges = useMemo(() => ranges.filter(r => r.isEnabled && r.isWork), [ranges]);

    const handleAIReschedule = async (rescheduleType: 'later' | 'tomorrow') => {
        if (!apiKey) {
            Alert.alert("Setup Required", "Please configure your Gemini API Key in settings first.");
            return;
        }

        setIsRescheduling(rescheduleType);
        try {
            const now = dayjs();
            const start = now.startOf('day').toDate();
            const end = now.add(2, 'day').endOf('day').toDate();

            const events = await getCalendarEvents(visibleCalendarIds, start, end);

            const context: AIRescheduleContext = {
                currentTime: now.toISOString(),
                workRanges: workRanges,
                upcomingEvents: events.map(e => ({
                    title: e.title,
                    start: new Date(e.startDate).toISOString(),
                    end: new Date(e.endDate).toISOString(),
                    difficulty: (e as any).difficulty
                }))
            };

            const suggestedTime = await rescheduleReminderWithAI(
                apiKey,
                rescheduleType,
                { title: title || "Untitled", content: initialEvent?.originalEvent?.content },
                context
            );

            if (suggestedTime) {
                setStartDate(new Date(suggestedTime));
            } else {
                Alert.alert("AI Suggestion", "Could not find a suitable time slot.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to reschedule with AI.");
        } finally {
            setIsRescheduling(null);
        }
    };

    const triggerSave = (scope?: 'this' | 'future' | 'all') => {
        const trimmedTitle = title.trim() || (type === 'event' ? 'New Event' : 'New Reminder');

        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        const persistentVal = persistent ? parseInt(persistent, 10) : undefined;

        const data: EventSaveData = {
            type,
            title: trimmedTitle,
            startDate,
            endDate,
            allDay: type === 'event' ? allDay : false,
            isWork: type === 'event' ? isWork : false,
            editScope: scope,
            alarm: type === 'alarm',
            persistent: (type === 'alarm' || type === 'reminder') ? (isNaN(persistentVal as number) ? undefined : persistentVal) : undefined
        };

        if (recurrenceFreq !== 'none') {
            const interval = parseInt(recurrenceInterval, 10);
            data.recurrenceRule = {
                frequency: recurrenceFreq,
                interval: isNaN(interval) || interval < 1 ? 1 : interval
            };
        } else {
             data.recurrenceRule = null;
        }

        onSave(data);
    };

    const handlePreSave = () => {
        const isRecurrent = initialEvent?.originalEvent?.recurrenceRule || initialEvent?.recurrenceRule || initialEvent?.isRecurrent;

        // Use scope selector only for Calendar Events that are recurring
        // Reminders handle recurrence differently (editing the file usually updates the rule for future too)
        // But if we want to support "this instance" for reminders, we'd need complex logic.
        // For now, let's keep scope selector for Events only.
        if (type === 'event' && initialEvent && isRecurrent) {
            setScopeAction('save');
            setShowScopeSelector(true);
        } else {
            triggerSave();
        }
    };

    const handlePreDelete = () => {
        if (!onDelete) return;

        if (type === 'event') {
            const isRecurrent = initialEvent?.originalEvent?.recurrenceRule || initialEvent?.recurrenceRule || initialEvent?.isRecurrent;
            if (isRecurrent) {
                setScopeAction('delete');
                setShowScopeSelector(true);
            } else {
                Alert.alert(
                    "Delete Event",
                    "Are you sure you want to delete this event?",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => onDelete({ scope: 'all' }) }
                    ]
                );
            }
        } else {
            // Reminder / Alarm Deletion
            Alert.alert(
                "Delete Reminder",
                "Do you also want to delete the source note file?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete Reminder Only",
                        onPress: () => onDelete({ deleteFile: false })
                    },
                    {
                        text: "Delete Note & Reminder",
                        style: "destructive",
                        onPress: () => onDelete({ deleteFile: true })
                    }
                ]
            );
        }
    };

    const handleScopeSelect = (scope: 'this' | 'future' | 'all') => {
        if (scopeAction === 'save') {
            triggerSave(scope);
        } else {
            if (onDelete) onDelete({ scope });
        }
    };

    const isEvent = type === 'event';

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700 max-h-[90%]">

                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">
                            {initialEvent ? 'Edit' : 'New'} {type === 'alarm' ? 'Alarm' : type === 'reminder' ? 'Reminder' : 'Event'}
                        </Text>
                        {initialEvent && onDelete && (
                            <TouchableOpacity onPress={handlePreDelete} className="bg-red-500/10 p-2 rounded-full">
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Type Selector */}
                    <View className="flex-row bg-slate-800 p-1 rounded-xl mb-4 border border-slate-700">
                        {(['event', 'reminder', 'alarm'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                onPress={() => setType(t)}
                                className={`flex-1 py-2 rounded-lg items-center ${type === t ? 'bg-indigo-600' : 'bg-transparent'}`}
                            >
                                <Text className={`font-semibold capitalize ${type === t ? 'text-white' : 'text-slate-400'}`}>
                                    {t}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {!showScopeSelector ? (
                        <>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Title */}
                                <View className="mb-4">
                                    <Text className="text-indigo-200 mb-2 font-medium">Title</Text>
                                    <TextInput
                                        className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholder={type === 'event' ? "Event Title" : "Reminder Title"}
                                        placeholderTextColor="#64748b"
                                        autoFocus={!initialEvent}
                                    />
                                </View>

                                {/* Time Section */}
                                <View className="mb-6">
                                    <Text className="text-indigo-200 mb-2 font-medium">Time</Text>

                                    {/* Date Picker */}
                                    <TouchableOpacity
                                        onPress={() => setShowDatePicker(true)}
                                        className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3 flex-row justify-between items-center"
                                    >
                                        <View className="flex-row items-center">
                                            <Ionicons name="calendar-outline" size={20} color="#818cf8" />
                                            <Text className="text-white font-bold text-lg ml-3">
                                                {startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#64748b" />
                                    </TouchableOpacity>

                                    {/* Time Row */}
                                    {(!allDay || !isEvent) && (
                                        <View className="flex-row gap-3 mb-3">
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker('start')}
                                                className="flex-1 bg-slate-800 p-3 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                            >
                                                <View className="flex-row items-center">
                                                    <Ionicons name="time-outline" size={20} color="#818cf8" />
                                                    <Text className="text-white font-bold text-lg ml-3">
                                                        {startDate.toLocaleTimeString([], {
                                                            hour12: timeFormat === '12h',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>

                                            {/* Duration presets (Event only) */}
                                            {isEvent && (
                                                <View className="flex-1 bg-slate-800 p-1.5 rounded-xl border border-slate-700 justify-center">
                                                    {!isCustomDuration ? (
                                                        <View className="flex-row justify-between items-center gap-x-1">
                                                            {[15, 30, 60, 90].map(mins => (
                                                                <TouchableOpacity
                                                                    key={mins}
                                                                    onPress={() => setDurationMinutes(mins)}
                                                                    className={`p-1.5 rounded-lg ${durationMinutes === mins ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                                                >
                                                                    <Text className="text-white text-[10px] font-bold">{mins}m</Text>
                                                                </TouchableOpacity>
                                                            ))}
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    setIsCustomDuration(true);
                                                                    // Default custom end time: +60 min
                                                                    setDurationMinutes(60);
                                                                }}
                                                                className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 items-center justify-center"
                                                            >
                                                                <Ionicons name="options-outline" size={14} color="#818cf8" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ) : (
                                                        <TouchableOpacity
                                                            onPress={() => setIsCustomDuration(false)}
                                                            className="flex-row items-center justify-center gap-2"
                                                        >
                                                            <Text className="text-indigo-400 text-[10px] font-bold uppercase tracking-wider">Presets</Text>
                                                            <Ionicons name="apps-outline" size={14} color="#818cf8" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Custom End Time Picker Row */}
                                    {isEvent && isCustomDuration && (
                                        <View className="mb-3">
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker('end')}
                                                className="bg-slate-800 p-3 rounded-xl border border-indigo-500/30 flex-row justify-between items-center"
                                            >
                                                <View className="flex-row items-center">
                                                    <Ionicons name="flag-outline" size={20} color="#f43f5e" />
                                                    <View className="ml-3">
                                                        <Text className="text-slate-400 text-[10px] uppercase font-bold">End Time</Text>
                                                        <Text className="text-white font-bold text-lg">
                                                            {new Date(startDate.getTime() + durationMinutes * 60000).toLocaleTimeString([], {
                                                                hour12: timeFormat === '12h',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={16} color="#64748b" />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* AI Reschedule (Reminder/Alarm only) */}
                                    {!isEvent && apiKey && (
                                        <View className="flex-row justify-end gap-2 mb-3">
                                            <TouchableOpacity
                                                onPress={() => handleAIReschedule('later')}
                                                disabled={!!isRescheduling}
                                                className={`px-3 py-1.5 rounded-full border ${isRescheduling === 'later' ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-indigo-500/30'}`}
                                            >
                                                {isRescheduling === 'later' ? (
                                                     <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <Text className="text-xs text-indigo-300">✨ Later</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleAIReschedule('tomorrow')}
                                                disabled={!!isRescheduling}
                                                className={`px-3 py-1.5 rounded-full border ${isRescheduling === 'tomorrow' ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-indigo-500/30'}`}
                                            >
                                                {isRescheduling === 'tomorrow' ? (
                                                     <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <Text className="text-xs text-indigo-300">✨ Tomorrow</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* Event Specific Switches */}
                                    {isEvent && (
                                        <View className="flex-row justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3">
                                            <View className="flex-row items-center gap-3">
                                                <Ionicons name="briefcase-outline" size={20} color="#818cf8" />
                                                <Text className="text-white font-medium">Is Work</Text>
                                            </View>
                                            <Switch
                                                value={isWork}
                                                onValueChange={setIsWork}
                                                trackColor={{ false: '#334155', true: '#4f46e5' }}
                                                thumbColor={isWork ? '#818cf8' : '#94a3b8'}
                                            />
                                        </View>
                                    )}

                                    {/* Recurrence Selector */}
                                    <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3">
                                        <Text className="text-indigo-200 mb-2 font-medium">Repeats</Text>
                                        <View className="flex-row flex-wrap gap-2 mb-3">
                                            {['none', 'daily', 'weekly', 'monthly', 'yearly'].map(freq => (
                                                <TouchableOpacity
                                                    key={freq}
                                                    onPress={() => setRecurrenceFreq(freq)}
                                                    className={`px-3 py-2 rounded-lg border ${
                                                        recurrenceFreq === freq
                                                        ? 'bg-indigo-600 border-indigo-500'
                                                        : 'bg-slate-700 border-slate-600'
                                                    }`}
                                                >
                                                    <Text className={`text-xs font-semibold capitalize ${
                                                        recurrenceFreq === freq ? 'text-white' : 'text-slate-300'
                                                    }`}>
                                                        {freq}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {recurrenceFreq !== 'none' && (
                                            <View className="flex-row items-center gap-3 mt-2 border-t border-slate-700 pt-3">
                                                <Text className="text-slate-400 text-sm">Every</Text>
                                                <TextInput
                                                    className="bg-slate-700 text-white px-4 py-2 rounded-lg w-20 text-center font-bold"
                                                    value={recurrenceInterval}
                                                    onChangeText={setRecurrenceInterval}
                                                    keyboardType="numeric"
                                                    maxLength={3}
                                                />
                                                <Text className="text-slate-400 text-sm capitalize">
                                                    {recurrenceFreq === 'daily' ? 'Days' :
                                                     recurrenceFreq === 'weekly' ? 'Weeks' :
                                                     recurrenceFreq === 'monthly' ? 'Months' : 'Years'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Advanced / Persistent (Alarm) */}
                                    {!isEvent && (
                                        <View>
                                            <TouchableOpacity
                                                onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                                className="flex-row items-center justify-between mb-2"
                                            >
                                                <Text className="text-indigo-200 font-medium">Advanced</Text>
                                                <Ionicons name={isAdvancedOpen ? "chevron-up" : "chevron-down"} size={20} color="#818cf8" />
                                            </TouchableOpacity>

                                            {isAdvancedOpen && (
                                                <View className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                                    <Text className="text-slate-400 text-xs mb-1">Persistent Nag (min)</Text>
                                                    <TextInput
                                                        className="bg-slate-800 text-white p-3 rounded-lg border border-slate-600"
                                                        placeholder="Nag interval (minutes)"
                                                        placeholderTextColor="#64748b"
                                                        keyboardType="numeric"
                                                        value={persistent}
                                                        onChangeText={setPersistent}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {showDatePicker && (
                                        <DateTimePicker
                                            value={startDate}
                                            mode="date"
                                            display="default"
                                            firstDayOfWeek={1}
                                            onChange={(event, selectedDate) => {
                                                setShowDatePicker(false);
                                                if (selectedDate) {
                                                    const newDate = new Date(selectedDate);
                                                    newDate.setHours(startDate.getHours());
                                                    newDate.setMinutes(startDate.getMinutes());
                                                    setStartDate(newDate);
                                                }
                                            }}
                                        />
                                    )}

                                    {showTimePicker && (
                                        <DateTimePicker
                                            value={showTimePicker === 'start' ? startDate : new Date(startDate.getTime() + durationMinutes * 60000)}
                                            mode="time"
                                            display="default"
                                            is24Hour={timeFormat === '24h'}
                                            onChange={(event, selectedDate) => {
                                                const pickerMode = showTimePicker;
                                                setShowTimePicker(null);
                                                if (selectedDate) {
                                                    if (pickerMode === 'start') {
                                                         const newDate = new Date(startDate);
                                                         newDate.setHours(selectedDate.getHours());
                                                         newDate.setMinutes(selectedDate.getMinutes());
                                                         setStartDate(newDate);
                                                    } else {
                                                         // Selecting End Time
                                                         const end = new Date(selectedDate);
                                                         // Calculate duration in minutes
                                                         const diff = Math.round((end.getTime() - startDate.getTime()) / 60000);
                                                         setDurationMinutes(diff > 0 ? diff : durationMinutes);
                                                    }
                                                }
                                            }}
                                        />
                                    )}
                                </View>

                                {linkedTasks.length > 0 && (
                                    <View className="mb-6">
                                        <Text className="text-indigo-200 mb-2 font-medium text-xs uppercase tracking-wider">Linked Tasks</Text>
                                        <View className="gap-2">
                                            {linkedTasks.map((t, i) => (
                                                <TouchableOpacity 
                                                    key={i} 
                                                    onPress={() => onOpenTask && onOpenTask(t)}
                                                    className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex-row items-center gap-2"
                                                >
                                                    <View className={`w-3 h-3 rounded-sm border ${t.completed ? 'bg-green-500 border-green-400' : 'bg-transparent border-slate-500'}`} />
                                                    <View className="flex-1">
                                                        <Text className={`text-white font-medium ${t.completed ? 'text-slate-500 line-through' : ''}`} numberOfLines={1}>
                                                            {t.title.replace(/^\[\[(.*)\]\]$/, '$1')}
                                                        </Text>
                                                    </View>
                                                    {onOpenTask && (
                                                        <Ionicons name="chevron-forward" size={16} color="#475569" />
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </ScrollView>

                            <View className="flex-row gap-3 mt-4">
                                <TouchableOpacity
                                    onPress={onCancel}
                                    className="flex-1 bg-slate-800 p-4 rounded-xl items-center"
                                >
                                    <Text className="text-white font-semibold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handlePreSave}
                                    className="flex-1 bg-indigo-600 p-4 rounded-xl items-center"
                                >
                                    <Text className="text-white font-semibold">
                                        {initialEvent ? 'Save' : 'Create'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <RecurrenceScopeModal
                            visible={showScopeSelector}
                            onClose={() => setShowScopeSelector(false)}
                            onSelect={handleScopeSelect}
                            actionType={scopeAction}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
