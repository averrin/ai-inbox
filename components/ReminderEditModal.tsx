import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface ReminderEditModalProps {
    visible: boolean;
    initialDate: Date;
    initialRecurrence: string;
    onSave: (date: Date, recurrence: string) => void;
    onCancel: () => void;
    timeFormat: '12h' | '24h';
}

export function ReminderEditModal({ 
    visible, 
    initialDate, 
    initialRecurrence, 
    onSave, 
    onCancel, 
    timeFormat 
}: ReminderEditModalProps) {
    const [editDate, setEditDate] = useState<Date>(new Date());
    const [editRecurrence, setEditRecurrence] = useState<string>('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setEditDate(new Date(initialDate));
            setEditRecurrence(initialRecurrence || '');
        }
    }, [visible, initialDate, initialRecurrence]);

    const handleSave = () => {
        onSave(editDate, editRecurrence);
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 px-4">
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-2xl border border-slate-700">
                    <Text className="text-white text-xl font-bold mb-4">Edit Reminder</Text>

                    <View className="mb-6">
                        <Text className="text-indigo-200 mb-2 font-medium">Time</Text>

                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-2"
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {editDate.toLocaleDateString()}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowTimePicker(true)}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700"
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {editDate.toLocaleTimeString([], {
                                    hour12: timeFormat === '12h',
                                    hour: '2-digit', 
                                    minute:'2-digit'
                                })}
                            </Text>
                        </TouchableOpacity>

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
                    
                    {/* Quick Reset Options */}
                    <View className="mb-4">
                        <Text className="text-indigo-200 mb-2 font-medium">Reset (Postpone)</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {[{ label: '+5m', min: 5 }, { label: '+15m', min: 15 }, { label: '+1h', min: 60 }, { label: '+1d', min: 1440 }].map((opt) => (
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

                    {/* Recurrence Rule */}
                    <View className="mb-6">
                        <Text className="text-indigo-200 mb-2 font-medium">Recurrence (Optional)</Text>
                        <TextInput
                            className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700"
                            placeholder="e.g. daily, weekly, 3 days"
                            placeholderTextColor="#64748b"
                            value={editRecurrence}
                            onChangeText={setEditRecurrence}
                        />
                        <Text className="text-slate-500 text-xs mt-1">
                            Supported: daily, weekly, monthly, yearly, "2 days", "30 minutes"
                        </Text>
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
