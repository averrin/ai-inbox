import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useReminderModal } from '../utils/reminderModalContext';
import { rescheduleReminderWithAI, AIRescheduleContext } from '../services/gemini';
import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { getCalendarEvents } from '../services/calendarService';
import dayjs from 'dayjs';

export interface ReminderSaveData {
    title?: string;
    date: Date;
    recurrence: string;
    alarm: boolean;
    persistent?: number;
}

interface ReminderEditModalProps {
    visible: boolean;
    initialDate?: Date;
    initialRecurrence: string;
    initialAlarm?: boolean;
    initialPersistent?: number;
    initialTitle?: string;
    initialContent?: string;
    initialFileUri?: string;
    enableTitle?: boolean;
    onSave: (data: ReminderSaveData) => void;
    onCancel: () => void;
    onDelete?: () => void;
    onShow?: () => void;
    timeFormat: '12h' | '24h';
}

export function ReminderEditModal({
    visible,
    initialDate,
    initialRecurrence,
    initialAlarm,
    initialPersistent,
    initialTitle = '',
    initialContent = '',
    initialFileUri = '',
    enableTitle = false,
    onSave,
    onCancel,
    onDelete,
    onShow,
    timeFormat
}: ReminderEditModalProps) {
    const { showReminder } = useReminderModal();
    // Lazy initialization for state
    const [editDate, setEditDate] = useState<Date>(() => initialDate || new Date());
    const [editRecurrence, setEditRecurrence] = useState<string>(initialRecurrence || '');
    const [editAlarm, setEditAlarm] = useState(initialAlarm || false);
    const [editPersistent, setEditPersistent] = useState(initialPersistent ? initialPersistent.toString() : '');
    const [editTitle, setEditTitle] = useState(initialTitle || '');
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // AI Rescheduling State
    const [isRescheduling, setIsRescheduling] = useState<null | 'later' | 'tomorrow'>(null);
    const apiKey = useSettingsStore(state => state.apiKey);
    const visibleCalendarIds = useSettingsStore(state => state.visibleCalendarIds);

    // Optimize selector
    const ranges = useEventTypesStore(state => state.ranges);
    const workRanges = React.useMemo(() => ranges.filter(r => r.isEnabled && r.isWork), [ranges]);

    const handleAIReschedule = async (type: 'later' | 'tomorrow') => {
        if (!apiKey) {
            alert("Please configure your Gemini API Key in settings first.");
            return;
        }

        setIsRescheduling(type);
        try {
            // 1. Gather Context
            const now = dayjs();
            const start = now.startOf('day').toDate();
            const end = now.add(2, 'day').endOf('day').toDate(); // Look ahead 48h

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

            // 2. Call AI
            const suggestedTime = await rescheduleReminderWithAI(
                apiKey,
                type,
                { title: initialTitle || editTitle || "Untitled Reminder", content: initialContent },
                context
            );

            // 3. Update State
            if (suggestedTime) {
                setEditDate(new Date(suggestedTime));
            } else {
                alert("AI couldn't find a suitable time. Please try manually.");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to reschedule with AI.");
        } finally {
            setIsRescheduling(null);
        }
    };

    useEffect(() => {
        if (visible) {
            setEditDate(initialDate ? new Date(initialDate) : new Date());
            setEditRecurrence(initialRecurrence || '');
            setEditAlarm(initialAlarm || false);
            setEditPersistent(initialPersistent ? initialPersistent.toString() : '');
            setEditTitle(initialTitle || '');
        }
    }, [visible, initialDate, initialRecurrence, initialAlarm, initialPersistent, initialTitle]);

    const handleSave = () => {
        const persistentVal = editPersistent ? parseInt(editPersistent, 10) : undefined;
        onSave({
            title: enableTitle ? editTitle : undefined,
            date: editDate,
            recurrence: editRecurrence,
            alarm: editAlarm,
            persistent: isNaN(persistentVal as number) ? undefined : persistentVal
        });
    };

    const isNew = !initialFileUri;
    const headerTitle = enableTitle
        ? (isNew ? 'New Reminder' : 'Edit Reminder')
        : 'Edit Reminder';

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">
                            {headerTitle}
                        </Text>
                        {onDelete && !isNew && (
                            <TouchableOpacity
                                onPress={() => {
                                    // Let parent handle confirmation or logic
                                    onDelete();
                                }}
                                className="bg-red-500/20 p-2 rounded-full"
                            >
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {enableTitle && (
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium">Title</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                                value={editTitle}
                                onChangeText={setEditTitle}
                                placeholder="What to remind you about?"
                                placeholderTextColor="#64748b"
                                autoFocus
                            />
                        </View>
                    )}

                    <View className="mb-6">
                        <Text className="text-indigo-200 mb-2 font-medium">Time</Text>

                        {/* Date Picker - Full Width */}
                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3 flex-row justify-between items-center"
                        >
                            <View className="flex-row items-center">
                                <Ionicons name="calendar-outline" size={20} color="#818cf8" />
                                <Text className="text-white font-bold text-lg ml-3">
                                    {editDate.toLocaleDateString()}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#64748b" />
                        </TouchableOpacity>

                        {/* Time & Alarm Row */}
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setShowTimePicker(true)}
                                className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center"
                            >
                                <View className="flex-row items-center">
                                    <Ionicons name="time-outline" size={20} color="#818cf8" />
                                    <Text className="text-white font-bold text-lg ml-3">
                                        {editDate.toLocaleTimeString([], {
                                            hour12: timeFormat === '12h',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View className="flex-1 bg-slate-800 p-2 rounded-xl border border-slate-700 justify-center px-4">
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-white font-medium">Alarm</Text>
                                    <Switch
                                        value={editAlarm}
                                        onValueChange={setEditAlarm}
                                        trackColor={{ false: "#334155", true: "#4f46e5" }}
                                        thumbColor={editAlarm ? "#ffffff" : "#94a3b8"}
                                    />
                                </View>
                            </View>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={editDate}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        // Preserve time
                                        const newDate = new Date(selectedDate);
                                        newDate.setHours(editDate.getHours());
                                        newDate.setMinutes(editDate.getMinutes());
                                        setEditDate(newDate);
                                    }
                                }}
                            />
                        )}

                        {showTimePicker && (
                            <DateTimePicker
                                value={editDate}
                                mode="time"
                                display="default"
                                is24Hour={timeFormat === '24h'}
                                onChange={(event, selectedDate) => {
                                    setShowTimePicker(false);
                                    if (selectedDate) {
                                        // Preserve date
                                        const newDate = new Date(editDate);
                                        newDate.setHours(selectedDate.getHours());
                                        newDate.setMinutes(selectedDate.getMinutes());
                                        setEditDate(newDate);
                                    }
                                }}
                            />
                        )}
                    </View>

                    {/* Quick Reschedule Options */}
                    <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-indigo-200 font-medium">Quick Reschedule</Text>
                            {apiKey && (
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={() => handleAIReschedule('later')}
                                        className={`px-3 py-1 rounded-full border ${isRescheduling === 'later' ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-indigo-500/30'}`}
                                        disabled={!!isRescheduling}
                                    >
                                        <Text className={`text-xs ${isRescheduling === 'later' ? 'text-white' : 'text-indigo-300'}`}>
                                            {isRescheduling === 'later' ? 'Thinking...' : '✨ Later'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleAIReschedule('tomorrow')}
                                        className={`px-3 py-1 rounded-full border ${isRescheduling === 'tomorrow' ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-indigo-500/30'}`}
                                        disabled={!!isRescheduling}
                                    >
                                        <Text className={`text-xs ${isRescheduling === 'tomorrow' ? 'text-white' : 'text-indigo-300'}`}>
                                            {isRescheduling === 'tomorrow' ? 'Thinking...' : '✨ Tomorrow'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                            {[
                                { label: '+1m', min: 1 },
                                { label: '+5m', min: 5 },
                                { label: '+15m', min: 15 },
                                { label: '+1h', min: 60 },
                                { label: '+1d', min: 1440 },
                                { label: '+7d', min: 10080 }
                            ].map((opt) => (
                                <TouchableOpacity
                                    key={opt.min}
                                    onPress={() => {
                                        const newDate = new Date(Date.now() + opt.min * 60 * 1000);
                                        setEditDate(newDate);
                                    }}
                                    className="bg-slate-700 px-3 py-2 rounded-lg"
                                >
                                    <Text className="text-white text-xs">{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Collapsible Advanced Section */}
                    <View className="mb-6">
                        <TouchableOpacity
                            onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
                            className="flex-row items-center justify-between mb-2"
                        >
                            <Text className="text-indigo-200 font-medium">Advanced</Text>
                            <Ionicons name={isAdvancedOpen ? "chevron-up" : "chevron-down"} size={20} color="#818cf8" />
                        </TouchableOpacity>

                        {isAdvancedOpen && (
                            <View className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 space-y-4">
                                {/* Recurrence Rule */}
                                <View>
                                    <Text className="text-slate-400 text-xs mb-1">Recurrence (Optional)</Text>
                                    <TextInput
                                        className="bg-slate-800 text-white p-3 rounded-lg border border-slate-600"
                                        placeholder="e.g. daily, weekly, 3 days"
                                        placeholderTextColor="#64748b"
                                        value={editRecurrence}
                                        onChangeText={setEditRecurrence}
                                    />
                                    <Text className="text-slate-500 text-[10px] mt-1 italic">
                                        Supports: daily, weekly, monthly, yearly, "2 days"
                                    </Text>
                                </View>

                                {/* Persistent */}
                                <View>
                                    <Text className="text-slate-400 text-xs mb-1">Persistent Nag (min)</Text>
                                    <TextInput
                                        className="bg-slate-800 text-white p-3 rounded-lg border border-slate-600"
                                        placeholder="Nag interval (minutes)"
                                        placeholderTextColor="#64748b"
                                        keyboardType="numeric"
                                        value={editPersistent}
                                        onChangeText={setEditPersistent}
                                    />
                                </View>
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={onCancel}
                            className="flex-1 bg-slate-800 p-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>

                        {/* Show Button (using onShow prop) */}
                        {onShow && (
                            <TouchableOpacity
                                onPress={onShow}
                                className="bg-amber-600/20 border border-amber-500/50 p-3 aspect-square rounded-xl items-center justify-center"
                            >
                                <Ionicons name="eye-outline" size={20} color="#fbbf24" />
                            </TouchableOpacity>
                        )}

                        {/* Fallback internal show (legacy support if needed, but onShow is preferred) */}
                        {!onShow && !enableTitle && (
                            <TouchableOpacity
                                onPress={() => {
                                    showReminder({
                                        fileUri: initialFileUri,
                                        fileName: initialTitle || 'Reminder',
                                        title: initialTitle,
                                        reminderTime: editDate.toISOString(),
                                        recurrenceRule: editRecurrence,
                                        alarm: editAlarm,
                                        persistent: editPersistent ? parseInt(editPersistent, 10) : undefined,
                                        content: initialContent
                                    });
                                }}
                                className="bg-amber-600/20 border border-amber-500/50 p-3 aspect-square rounded-xl items-center justify-center"
                            >
                                <Ionicons name="eye-outline" size={20} color="#fbbf24" />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={handleSave}
                            className="flex-1 bg-indigo-600 p-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
