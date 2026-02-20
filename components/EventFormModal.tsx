
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
import { TaskStatusIcon } from './ui/TaskStatusIcon';
import { ColorPicker } from './ui/ColorPicker';
import { Palette, Colors } from './ui/design-tokens';



export interface EventSaveData {
    type: 'event' | 'reminder' | 'alarm' | 'zone';
    title: string;
    startDate: Date;
    endDate: Date;
    allDay: boolean;
    isWork: boolean;
    isNonFree?: boolean; // New flag for zones
    recurrenceRule?: {
        frequency: string; // 'daily', 'weekly', 'monthly', 'yearly'
        interval?: number;
        endDate?: Date;
        occurrence?: number;
    } | null;
    editScope?: 'this' | 'future' | 'all';
    alarm?: boolean;
    persistent?: number;
    content?: string;
    color?: string;
}

export interface DeleteOptions {
    scope?: 'this' | 'future' | 'all';
    deleteFile?: boolean;
}

interface EventFormModalProps {
    visible: boolean;
    initialDate?: Date;
    initialEvent?: any; // Calendar event object for editing
    initialType?: 'event' | 'reminder' | 'alarm' | 'zone';
    initialTitle?: string;
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
    initialTitle,
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
    const [type, setType] = useState<'event' | 'reminder' | 'alarm' | 'zone'>('event');
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [allDay, setAllDay] = useState(false);
    const [isWork, setIsWork] = useState(false);
    const [recurrenceFreq, setRecurrenceFreq] = useState<string>('none'); // 'none', 'daily', 'weekly', 'monthly', 'yearly'
    const [recurrenceInterval, setRecurrenceInterval] = useState<string>('1');
    const [persistent, setPersistent] = useState<string>(''); // For Alarm
    const [content, setContent] = useState('');
    const [color, setColor] = useState(Palette[0]); // Default Red
    const [isNonFree, setIsNonFree] = useState(false);

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
            let defaultType: 'event' | 'reminder' | 'alarm' | 'zone' = initialType || 'event';

            if (initialEvent) {
                if (initialEvent.typeTag === 'REMINDER' || initialEvent.originalEvent?.fileUri) {
                    defaultType = initialEvent.originalEvent?.alarm ? 'alarm' : 'reminder';
                } else if (initialEvent.typeTag === 'ZONE') {
                    defaultType = 'zone';
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
                setContent(initialEvent.originalEvent?.content || '');
                setColor(initialEvent.color || Palette[0]);
                
                // Initialize isNonFree from content/notes
                const noteContent = initialEvent.originalEvent?.content || initialEvent.originalEvent?.notes || '';
                setIsNonFree(noteContent.includes('[nonFree::true]'));

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
                setTitle(initialTitle || '');
                setDurationMinutes(60);
                setAllDay(false);
                setIsWork(false);
                setRecurrenceFreq('none');
                setRecurrenceInterval('1');
                setPersistent('');
                setIsCustomDuration(false);
                setContent('');
                setColor(Palette[0]);
                setIsNonFree(false);
            }
        }
    }, [visible, initialDate, initialEvent, initialType, initialTitle]);

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
        const trimmedTitle = title.trim() || (type === 'event' ? 'New Event' : type === 'zone' ? 'New Zone' : 'New Reminder');

        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        const persistentVal = persistent ? parseInt(persistent, 10) : undefined;

        const data: EventSaveData = {
            type,
            title: trimmedTitle,
            startDate,
            endDate,
            allDay: (type === 'event' || type === 'zone') ? allDay : false,
            isWork: type === 'event' ? isWork : false,
            editScope: scope,
            alarm: type === 'alarm',
            isNonFree: type === 'zone' ? isNonFree : undefined,
            persistent: (type === 'alarm' || type === 'reminder') ? (isNaN(persistentVal as number) ? undefined : persistentVal) : undefined,
            content: (type === 'reminder' || type === 'alarm' || type === 'zone') ? content : undefined,
            color: type === 'zone' ? color : undefined
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
        const isRecurrent = initialEvent?.originalEvent?.recurrenceRule || initialEvent?.recurrenceRule || initialEvent?.isRecurrent || !!initialEvent?.originalEvent?.originalId || !!initialEvent?.originalEvent?.instanceStartDate;

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

        if (type === 'event' || type === 'zone') {
            const isRecurrent = initialEvent?.originalEvent?.recurrenceRule || initialEvent?.recurrenceRule || initialEvent?.isRecurrent;
            if (isRecurrent) {
                setScopeAction('delete');
                setShowScopeSelector(true);
            } else {
                Alert.alert(
                    `Delete ${type === 'zone' ? 'Zone' : 'Event'}`,
                    `Are you sure you want to delete this ${type === 'zone' ? 'zone' : 'event'}?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => onDelete({ scope: 'all' }) }
                    ]
                );
            }
        } else {
            // Reminder / Alarm Deletion
            if (onDelete) onDelete({ deleteFile: false });
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
    const isZone = type === 'zone';

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-background w-full max-w-md p-6 rounded-3xl border border-border max-h-[90%]">

                    {/* Header */}
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">
                            {initialEvent ? 'Edit' : 'New'} {type === 'alarm' ? 'Alarm' : type === 'reminder' ? 'Reminder' : type === 'zone' ? 'Zone' : 'Event'}
                        </Text>
                        {initialEvent && onDelete && (
                            <TouchableOpacity onPress={handlePreDelete} className="bg-error/10 p-2 rounded-full">
                                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Type Selector */}
                    <View className="flex-row bg-surface p-1 rounded-xl mb-4 border border-border">
                        {(['event', 'reminder', 'alarm', 'zone'] as const).map((t) => (
                            <TouchableOpacity
                                key={t}
                                onPress={() => setType(t)}
                                className={`flex-1 py-2 rounded-lg items-center ${type === t ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`font-semibold capitalize ${type === t ? 'text-white' : 'text-text-secondary'}`}>
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
                                    <Text className="text-text-secondary mb-2 font-medium">Title</Text>
                                    <TextInput
                                        className="bg-surface text-white p-4 rounded-xl border border-border font-medium"
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholder={type === 'event' ? "Event Title" : type === 'zone' ? "Zone Title" : "Reminder Title"}
                                        placeholderTextColor={Colors.text.secondary}
                                        autoFocus={!initialEvent}
                                    />
                                </View>

                                {/* Color Picker (Zone Only) */}
                                {isZone && (
                                    <View className="mb-4">
                                        <ColorPicker
                                            value={color}
                                            onChange={setColor}
                                            label="Color"
                                        />
                                    </View>
                                )}

                                {(!isEvent && !isZone) && (
                                    <View className="mb-4">
                                        <Text className="text-text-secondary mb-2 font-medium">Content</Text>
                                        <TextInput
                                            className="bg-surface text-white p-4 rounded-xl border border-border min-h-[80px]"
                                            value={content}
                                            onChangeText={setContent}
                                            placeholder="Details..."
                                            placeholderTextColor={Colors.text.secondary}
                                            multiline
                                            textAlignVertical="top"
                                        />
                                    </View>
                                )}

                                {/* Time Section */}
                                <View className="mb-6">
                                    <Text className="text-text-secondary mb-2 font-medium">Time</Text>

                                    {/* Date Picker Row */}
                                    <View className="flex-row gap-3 mb-3">
                                        <TouchableOpacity
                                            onPress={() => setShowDatePicker(true)}
                                            className="flex-1 bg-surface p-4 rounded-xl border border-border flex-row justify-between items-center"
                                        >
                                            <View className="flex-row items-center">
                                                <Ionicons name="calendar-outline" size={20} color="#818cf8" />
                                                <Text className="text-white font-bold text-lg ml-3">
                                                    {dayjs(startDate).isSame(dayjs(), 'day')
                                                        ? `Today, ${dayjs(startDate).format('MMM D')}`
                                                        : startDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                                                    }
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => {
                                                const nextDay = new Date(startDate);
                                                nextDay.setDate(nextDay.getDate() + 1);
                                                setStartDate(nextDay);
                                            }}
                                            className="bg-surface p-4 rounded-xl border border-border items-center justify-center"
                                        >
                                            <Text className="text-primary font-bold text-lg">+1d</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Time Row */}
                                    {(!allDay || (!isEvent && !isZone)) && (
                                        <View className="flex-row gap-3 mb-3">
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker('start')}
                                                className="flex-1 bg-surface p-3 rounded-xl border border-border flex-row justify-between items-center"
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

                                            {/* Duration presets (Event/Zone only) */}
                                            {(isEvent || isZone) && (
                                                <View className="flex-1 bg-surface p-1.5 rounded-xl border border-border justify-center">
                                                    {!isCustomDuration ? (
                                                        <View className="flex-row justify-between items-center gap-x-1">
                                                            {[15, 30, 60, 90].map(mins => (
                                                                <TouchableOpacity
                                                                    key={mins}
                                                                    onPress={() => setDurationMinutes(mins)}
                                                                    className={`p-1.5 rounded-lg ${durationMinutes === mins ? 'bg-primary' : 'bg-surface-highlight'}`}
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
                                                                className="p-1.5 rounded-lg bg-primary border border-primary items-center justify-center"
                                                            >
                                                                <Ionicons name="options-outline" size={14} color="#818cf8" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ) : (
                                                        <TouchableOpacity
                                                            onPress={() => setIsCustomDuration(false)}
                                                            className="flex-row items-center justify-center gap-2"
                                                        >
                                                            <Text className="text-primary text-[10px] font-bold uppercase tracking-wider">Presets</Text>
                                                            <Ionicons name="apps-outline" size={14} color="#818cf8" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Custom End Time Picker Row */}
                                    {(isEvent || isZone) && isCustomDuration && (
                                        <View className="mb-3">
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker('end')}
                                                className="bg-surface p-3 rounded-xl border border-primary flex-row justify-between items-center"
                                            >
                                                <View className="flex-row items-center">
                                                    <Ionicons name="flag-outline" size={20} color={Palette[1]} />
                                                    <View className="ml-3">
                                                        <Text className="text-text-tertiary text-[10px] uppercase font-bold">End Time</Text>
                                                        <Text className="text-white font-bold text-lg">
                                                            {new Date(startDate.getTime() + durationMinutes * 60000).toLocaleTimeString([], {
                                                                hour12: timeFormat === '12h',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* AI Reschedule (Reminder/Alarm only) */}
                                    {(!isEvent && !isZone) && apiKey && (
                                        <View className="flex-row justify-end gap-2 mb-3">
                                            <TouchableOpacity
                                                onPress={() => handleAIReschedule('later')}
                                                disabled={!!isRescheduling}
                                                className={`px-3 py-1.5 rounded-full border ${isRescheduling === 'later' ? 'bg-primary border-primary' : 'bg-surface border-primary'}`}
                                            >
                                                {isRescheduling === 'later' ? (
                                                     <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <Text className="text-xs text-text-secondary">✨ Later</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleAIReschedule('tomorrow')}
                                                disabled={!!isRescheduling}
                                                className={`px-3 py-1.5 rounded-full border ${isRescheduling === 'tomorrow' ? 'bg-primary border-primary' : 'bg-surface border-primary'}`}
                                            >
                                                {isRescheduling === 'tomorrow' ? (
                                                     <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <Text className="text-xs text-text-secondary">✨ Tomorrow</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {/* Zone Specific Switches */}
                                    {isZone && (
                                        <View className="flex-row justify-between items-center bg-surface p-4 rounded-xl border border-border mb-3">
                                            <View className="flex-row items-center gap-3">
                                                <Ionicons name="hand-left-outline" size={20} color={Palette[1]} />
                                                <View>
                                                    <Text className="text-white font-medium">Non-Free</Text>
                                                    <Text className="text-text-tertiary text-xs">Blocks free time generation</Text>
                                                </View>
                                            </View>
                                            <Switch
                                                value={isNonFree}
                                                onValueChange={setIsNonFree}
                                                trackColor={{ false: Colors.surfaceHighlight, true: Palette[1] }}
                                                thumbColor={isNonFree ? '#fb7185' : Colors.text.tertiary}
                                            />
                                        </View>
                                    )}

                                    {/* Event Specific Switches */}
                                    {isEvent && (
                                        <View className="flex-row justify-between items-center bg-surface p-4 rounded-xl border border-border mb-3">
                                            <View className="flex-row items-center gap-3">
                                                <Ionicons name="briefcase-outline" size={20} color="#818cf8" />
                                                <Text className="text-white font-medium">Is Work</Text>
                                            </View>
                                            <Switch
                                                value={isWork}
                                                onValueChange={setIsWork}
                                                trackColor={{ false: Colors.surfaceHighlight, true: '#4f46e5' }}
                                                thumbColor={isWork ? '#818cf8' : Colors.text.tertiary}
                                            />
                                        </View>
                                    )}

                                    {/* Recurrence Selector */}
                                    <View className="bg-surface p-4 rounded-xl border border-border mb-3">
                                        <Text className="text-text-secondary mb-2 font-medium">Repeats</Text>
                                        <View className="flex-row flex-wrap gap-2 mb-3">
                                            {['none', 'daily', 'weekly', 'monthly', 'yearly'].map(freq => (
                                                <TouchableOpacity
                                                    key={freq}
                                                    onPress={() => setRecurrenceFreq(freq)}
                                                    className={`px-3 py-2 rounded-lg border ${
                                                        recurrenceFreq === freq
                                                        ? 'bg-primary border-primary'
                                                        : 'bg-surface-highlight border-border'
                                                    }`}
                                                >
                                                    <Text className={`text-xs font-semibold capitalize ${
                                                        recurrenceFreq === freq ? 'text-white' : 'text-text-secondary'
                                                    }`}>
                                                        {freq}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {recurrenceFreq !== 'none' && (
                                            <View className="flex-row items-center gap-3 mt-2 border-t border-border pt-3">
                                                <Text className="text-text-tertiary text-sm">Every</Text>
                                                <TextInput
                                                    className="bg-surface-highlight text-white px-4 py-2 rounded-lg w-20 text-center font-bold"
                                                    value={recurrenceInterval}
                                                    onChangeText={setRecurrenceInterval}
                                                    keyboardType="numeric"
                                                    maxLength={3}
                                                />
                                                <Text className="text-text-tertiary text-sm capitalize">
                                                    {recurrenceFreq === 'daily' ? 'Days' :
                                                     recurrenceFreq === 'weekly' ? 'Weeks' :
                                                     recurrenceFreq === 'monthly' ? 'Months' : 'Years'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Advanced / Persistent (Alarm) */}
                                    {(!isEvent && !isZone) && (
                                        <View>
                                            <TouchableOpacity
                                                onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
                                                className="flex-row items-center justify-between mb-2"
                                            >
                                                <Text className="text-text-secondary font-medium">Advanced</Text>
                                                <Ionicons name={isAdvancedOpen ? "chevron-up" : "chevron-down"} size={20} color="#818cf8" />
                                            </TouchableOpacity>

                                            {isAdvancedOpen && (
                                                <View className="bg-surface/50 p-4 rounded-xl border border-border">
                                                    <Text className="text-text-tertiary text-xs mb-1">Persistent Nag (min)</Text>
                                                    <TextInput
                                                        className="bg-surface text-white p-3 rounded-lg border border-border"
                                                        placeholder="Nag interval (minutes)"
                                                        placeholderTextColor={Colors.text.secondary}
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
                                                         const newEnd = new Date(startDate);
                                                         newEnd.setHours(selectedDate.getHours());
                                                         newEnd.setMinutes(selectedDate.getMinutes());

                                                         // Calculate duration in minutes
                                                         const diff = Math.round((newEnd.getTime() - startDate.getTime()) / 60000);
                                                         setDurationMinutes(diff > 0 ? diff : durationMinutes);
                                                    }
                                                }
                                            }}
                                        />
                                    )}
                                </View>

                                {linkedTasks.length > 0 && (
                                    <View className="mb-6">
                                        <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">Linked Tasks</Text>
                                        <View className="gap-2">
                                            {linkedTasks.map((t, i) => (
                                                <TouchableOpacity 
                                                    key={i} 
                                                    onPress={() => onOpenTask && onOpenTask(t)}
                                                    className="bg-surface p-3 rounded-xl border border-border flex-row items-center gap-2"
                                                >
                                                    <TaskStatusIcon status={t.status} size={16} />
                                                    <View className="flex-1">
                                                        <Text className={`text-white font-medium ${t.completed ? 'text-secondary line-through' : ''}`} numberOfLines={1}>
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
                                    className="flex-1 bg-surface p-4 rounded-xl items-center"
                                >
                                    <Text className="text-white font-semibold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handlePreSave}
                                    className="flex-1 bg-primary p-4 rounded-xl items-center"
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
