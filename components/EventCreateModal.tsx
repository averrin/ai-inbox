
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export interface EventSaveData {
    title: string;
    startDate: Date;
    endDate: Date;
    allDay: boolean;
}

interface EventCreateModalProps {
    visible: boolean;
    initialDate: Date;
    onSave: (data: EventSaveData) => void;
    onCancel: () => void;
    timeFormat: '12h' | '24h';
}

export function EventCreateModal({
    visible,
    initialDate,
    onSave,
    onCancel,
    timeFormat
}: EventCreateModalProps) {
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState<Date>(new Date());
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [allDay, setAllDay] = useState(false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setStartDate(new Date(initialDate));
            setTitle('');
            setDurationMinutes(60);
            setAllDay(false);
        }
    }, [visible, initialDate]);

    const handleSave = () => {
        if (!title.trim()) return;

        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        onSave({
            title,
            startDate,
            endDate,
            allDay: false // Force false as removed from UI
        });
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700">
                    <Text className="text-white text-xl font-bold mb-4">
                        New Event
                    </Text>

                    <View className="mb-4">
                        <Text className="text-indigo-200 mb-2 font-medium">Title</Text>
                        <TextInput
                            className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Event Title"
                            placeholderTextColor="#64748b"
                            autoFocus
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



                        {showDatePicker && (
                            <DateTimePicker
                                value={startDate}
                                mode="date"
                                display="default"
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

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={onCancel}
                            className="flex-1 bg-slate-800 p-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={!title.trim()}
                            className={`flex-1 p-4 rounded-xl items-center ${!title.trim() ? 'bg-slate-700' : 'bg-indigo-600'}`}
                        >
                            <Text className={`font-semibold ${!title.trim() ? 'text-slate-500' : 'text-white'}`}>Create</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
