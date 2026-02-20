import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Action } from '../services/gemini';
import { Colors } from './ui/design-tokens';

interface EventEditModalProps {
    visible: boolean;
    initialEvent: Action | null;
    onSave: (event: Action) => void;
    onCancel: () => void;
    timeFormat: '12h' | '24h';
}

export function EventEditModal({ 
    visible, 
    initialEvent, 
    onSave, 
    onCancel, 
    timeFormat 
}: EventEditModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState<Date>(new Date());
    const [duration, setDuration] = useState('30');
    const [recurrence, setRecurrence] = useState('');
    
    // Pickers
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible && initialEvent) {
            setTitle(initialEvent.title || '');
            setDescription(initialEvent.description || '');
            setStartTime(initialEvent.startTime ? new Date(initialEvent.startTime) : new Date());
            setDuration(initialEvent.durationMinutes ? initialEvent.durationMinutes.toString() : '30');
            
            // Handle recurrence: array to string
            if (Array.isArray(initialEvent.recurrence) && initialEvent.recurrence.length > 0) {
                setRecurrence(initialEvent.recurrence.join('; '));
            } else if (typeof initialEvent.recurrence === 'string') {
                 setRecurrence(initialEvent.recurrence);
            } else {
                setRecurrence('');
            }
        }
    }, [visible, initialEvent]);

    const handleSave = () => {
        if (!initialEvent) return;

        const updatedEvent: Action = {
            ...initialEvent,
            title,
            description,
            startTime: startTime.toISOString(),
            durationMinutes: parseInt(duration) || 30,
            recurrence: recurrence.trim() ? [recurrence] : undefined // Simple single rule support for now
        };
        onSave(updatedEvent);
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-lg p-6 rounded-2xl border border-slate-700 max-h-[90%]">
                    <Text className="text-white text-xl font-bold mb-4">Edit Event</Text>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Title */}
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium">Title</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Event title"
                                placeholderTextColor={Colors.secondary}
                            />
                        </View>

                        {/* Valid Date/Time */}
                        {/* Unlike Reminder, Events usually have specific times. */}
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium">Start Time</Text>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700"
                                >
                                    <Text className="text-white text-center font-bold">
                                        {startTime.toLocaleDateString()}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setShowTimePicker(true)}
                                    className="flex-1 bg-slate-800 p-4 rounded-xl border border-slate-700"
                                >
                                    <Text className="text-white text-center font-bold">
                                        {startTime.toLocaleTimeString([], {
                                            hour12: timeFormat === '12h',
                                            hour: '2-digit', 
                                            minute:'2-digit'
                                        })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Pickers */}
                        {showDatePicker && (
                            <DateTimePicker
                                value={startTime}
                                mode="date"
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        const newDate = new Date(selectedDate);
                                        newDate.setHours(startTime.getHours());
                                        newDate.setMinutes(startTime.getMinutes());
                                        setStartTime(newDate);
                                    }
                                }}
                            />
                        )}
                        {showTimePicker && (
                            <DateTimePicker
                                value={startTime}
                                mode="time"
                                is24Hour={timeFormat === '24h'}
                                onChange={(event, selectedDate) => {
                                    setShowTimePicker(false);
                                    if (selectedDate) {
                                        const newDate = new Date(startTime);
                                        newDate.setHours(selectedDate.getHours());
                                        newDate.setMinutes(selectedDate.getMinutes());
                                        setStartTime(newDate);
                                    }
                                }}
                            />
                        )}

                        {/* Duration */}
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium">Duration (minutes)</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700"
                                value={duration}
                                onChangeText={setDuration}
                                keyboardType="numeric"
                                placeholder="30"
                                placeholderTextColor={Colors.secondary}
                            />
                        </View>

                         {/* Description */}
                         <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium">Description</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 min-h-[80px]"
                                value={description}
                                onChangeText={setDescription}
                                multiline
                                textAlignVertical="top"
                                placeholder="Notes, agenda, etc."
                                placeholderTextColor={Colors.secondary}
                            />
                        </View>

                        {/* Recurrence Rule */}
                        <View className="mb-6">
                            <Text className="text-indigo-200 mb-2 font-medium">Recurrence (RRULE)</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700"
                                value={recurrence}
                                onChangeText={setRecurrence}
                                placeholder="e.g. RRULE:FREQ=WEEKLY;BYDAY=FR"
                                placeholderTextColor={Colors.secondary}
                                autoCapitalize="none"
                            />
                            <Text className="text-slate-500 text-xs mt-1">
                                Enter a valid iCalendar RRULE string.
                            </Text>
                        </View>
                    </ScrollView>

                    <View className="flex-row gap-3 mt-auto">
                        <TouchableOpacity
                            onPress={onCancel}
                            className="flex-1 bg-slate-800 p-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSave}
                            className="flex-1 bg-indigo-600 p-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
