
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Switch, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export interface EventSaveData {
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
}

interface EventFormModalProps {
    visible: boolean;
    initialDate?: Date;
    initialEvent?: any; // Calendar event object for editing
    onSave: (data: EventSaveData) => void;
    onDelete?: (scope?: 'this' | 'future' | 'all') => void;
    onCancel: () => void;
    timeFormat: '12h' | '24h';
}

export function EventFormModal({
    visible,
    initialDate,
    initialEvent,
    onSave,
    onDelete,
    onCancel,
    timeFormat
}: EventFormModalProps) {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [allDay, setAllDay] = useState(false);
    const [isWork, setIsWork] = useState(false);
    const [recurrenceFreq, setRecurrenceFreq] = useState<string>('none'); // 'none', 'daily', 'weekly', 'monthly', 'yearly'
    const [recurrenceInterval, setRecurrenceInterval] = useState<string>('1');

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showScopeSelector, setShowScopeSelector] = useState(false);
    const [scopeAction, setScopeAction] = useState<'save' | 'delete'>('save');

    useEffect(() => {
        if (visible) {
            setShowScopeSelector(false);
            setScopeAction('save');
            if (initialEvent) {
                // Edit Mode
                setTitle(initialEvent.title || '');
                const start = new Date(initialEvent.start || initialEvent.startDate);
                const end = new Date(initialEvent.end || initialEvent.endDate);
                setStartDate(start);

                const diffMins = Math.round((end.getTime() - start.getTime()) / 60000);
                setDurationMinutes(diffMins > 0 ? diffMins : 60);

                setAllDay(initialEvent.allDay || false);
                setIsWork(initialEvent.isWork || false); // Custom flag support

                // Recurrence
                const rule = initialEvent.originalEvent?.recurrenceRule;
                if (rule && rule.frequency) {
                    setRecurrenceFreq(rule.frequency.toLowerCase());
                    setRecurrenceInterval(rule.interval ? rule.interval.toString() : '1');
                } else {
                    setRecurrenceFreq('none');
                    setRecurrenceInterval('1');
                }

            } else {
                // Create Mode
                setStartDate(initialDate ? new Date(initialDate) : new Date());
                setTitle('');
                setDurationMinutes(60);
                setAllDay(false);
                setIsWork(false);
                setRecurrenceFreq('none');
                setRecurrenceInterval('1');
            }
        }
    }, [visible, initialDate, initialEvent]);

    const triggerSave = (scope?: 'this' | 'future' | 'all') => {
        if (!title.trim()) return;

        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

        const data: EventSaveData = {
            title,
            startDate,
            endDate,
            allDay: false,
            isWork,
            editScope: scope
        };

        if (recurrenceFreq !== 'none') {
            const interval = parseInt(recurrenceInterval, 10);
            data.recurrenceRule = {
                frequency: recurrenceFreq,
                interval: isNaN(interval) || interval < 1 ? 1 : interval
            };
        } else {
             // Explicitly clear recurrence if it was present
             data.recurrenceRule = null;
        }

        onSave(data);
    };

    const handlePreSave = () => {
        // If editing a recurring event, ask for scope
        const isRecurrent = initialEvent?.originalEvent?.recurrenceRule || initialEvent?.recurrenceRule || initialEvent?.isRecurrent;
        if (initialEvent && isRecurrent) {
            setScopeAction('save');
            setShowScopeSelector(true);
        } else {
            triggerSave();
        }
    };

    const handlePreDelete = () => {
        if (!onDelete) return;

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
                    { text: "Delete", style: "destructive", onPress: () => onDelete() }
                ]
            );
        }
    };

    const handleScopeSelect = (scope: 'this' | 'future' | 'all') => {
        if (scopeAction === 'save') {
            triggerSave(scope);
        } else {
            if (onDelete) onDelete(scope);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700 max-h-[90%]">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">
                            {initialEvent ? 'Edit Event' : 'New Event'}
                        </Text>
                        {initialEvent && onDelete && (
                            <TouchableOpacity onPress={handlePreDelete}>
                                <Ionicons name="trash-outline" size={24} color="#ef4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {!showScopeSelector ? (
                        <>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View className="mb-4">
                                    <Text className="text-indigo-200 mb-2 font-medium">Title</Text>
                                    <TextInput
                                        className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                                        value={title}
                                        onChangeText={setTitle}
                                        placeholder="Event Title"
                                        placeholderTextColor="#64748b"
                                        autoFocus={!initialEvent}
                                    />
                                </View>

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
                                                {startDate.toLocaleDateString()}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Time & Duration Row */}
                                    {!allDay && (
                                        <View className="flex-row gap-3 mb-3">
                                            <TouchableOpacity
                                                onPress={() => setShowTimePicker(true)}
                                                className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center"
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

                                            {/* Duration presets */}
                                            <View className="flex-1 bg-slate-800 p-2 rounded-xl border border-slate-700 justify-center">
                                                <View className="flex-row justify-around">
                                                    {[15, 30, 60, 90].map(mins => (
                                                        <TouchableOpacity
                                                            key={mins}
                                                            onPress={() => setDurationMinutes(mins)}
                                                            className={`p-2 rounded-lg ${durationMinutes === mins ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                                        >
                                                            <Text className="text-white text-xs font-bold">{mins}m</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        </View>
                                    )}


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
                                            value={startDate}
                                            mode="time"
                                            display="default"
                                            is24Hour={timeFormat === '24h'}
                                            onChange={(event, selectedDate) => {
                                                setShowTimePicker(false);
                                                if (selectedDate) {
                                                    const newDate = new Date(startDate);
                                                    newDate.setHours(selectedDate.getHours());
                                                    newDate.setMinutes(selectedDate.getMinutes());
                                                    setStartDate(newDate);
                                                }
                                            }}
                                        />
                                    )}
                                </View>
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
                                    disabled={!title.trim()}
                                    className={`flex-1 p-4 rounded-xl items-center ${!title.trim() ? 'bg-slate-700' : 'bg-indigo-600'}`}
                                >
                                    <Text className={`font-semibold ${!title.trim() ? 'text-slate-500' : 'text-white'}`}>
                                        {initialEvent ? 'Save' : 'Create'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View className="py-4">
                            <Text className="text-slate-300 text-center mb-6">
                                This is a recurring event. How would you like to apply your {scopeAction === 'delete' ? 'deletion' : 'changes'}?
                            </Text>

                            <View className="gap-3">
                                <TouchableOpacity
                                    onPress={() => handleScopeSelect('this')}
                                    className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                                >
                                    <Text className="text-white font-semibold">This event only</Text>
                                    <Ionicons name="calendar-outline" size={20} color="#94a3b8" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleScopeSelect('future')}
                                    className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                                >
                                    <Text className="text-white font-semibold">This and following events</Text>
                                    <Ionicons name="albums-outline" size={20} color="#94a3b8" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => handleScopeSelect('all')}
                                    className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                                >
                                    <Text className="text-white font-semibold">All events in series</Text>
                                    <Ionicons name="infinite-outline" size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowScopeSelector(false)}
                                className="mt-6 p-4 rounded-xl items-center"
                            >
                                <Text className="text-slate-500 font-semibold">Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}
