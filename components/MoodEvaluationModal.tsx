import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
// NOTE: We use standard style props for dynamic styling in loops to avoid react-native-css-interop issues with NavigationContext
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useMoodStore } from '../store/moodStore';
import { useHabitStore } from '../store/habitStore';
import { syncMoodReminders } from '../services/reminderService';
import { ForecastSection } from './ForecastSection';

interface MoodEvaluationModalProps {
    visible: boolean;
    onClose: () => void;
    date: Date;
}

const MOOD_OPTIONS = [
    { value: 1, color: '#ef4444', label: 'Very Bad', icon: 'thunderstorm-outline' },
    { value: 2, color: '#f97316', label: 'Bad', icon: 'rainy-outline' },
    { value: 3, color: '#eab308', label: 'Neutral', icon: 'cloudy-outline' },
    { value: 4, color: '#84cc16', label: 'Good', icon: 'partly-sunny-outline' },
    { value: 5, color: '#22c55e', label: 'Excellent', icon: 'sunny-outline' },
];

export function MoodEvaluationModal({ visible, onClose, date }: MoodEvaluationModalProps) {
    const { moods, setMood } = useMoodStore();
    const { habits, records, setHabitStatus, getHabitStatus } = useHabitStore();
    const dateStr = dayjs(date).format('YYYY-MM-DD');

    const [selectedMood, setSelectedMood] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [checkedHabits, setCheckedHabits] = useState<Record<string, boolean>>({});

    // Filter enabled habits
    const activeHabits = habits.filter(h => h.isEnabled);

    useEffect(() => {
        if (visible) {
            const entry = moods[dateStr];
            if (entry) {
                setSelectedMood(entry.mood);
                setNote(entry.note);
            } else {
                setSelectedMood(null);
                setNote('');
            }
            
            // Load habit statuses
            const currentChecks: Record<string, boolean> = {};
            activeHabits.forEach(h => {
                currentChecks[h.id] = records[dateStr]?.[h.id] || false;
            });
            setCheckedHabits(currentChecks);
        }
    }, [visible, dateStr, moods, records, habits]);

    const handleSave = () => {
        if (selectedMood !== null) {
            setMood(dateStr, selectedMood, note);
            
            // Save habits
            Object.keys(checkedHabits).forEach(habitId => {
                setHabitStatus(dateStr, habitId, checkedHabits[habitId]);
            });

            // Sync reminders to cancel today's notification
            syncMoodReminders();
        }
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center items-center bg-black/50 px-4"
            >
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700">
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-white text-xl font-bold">
                                Evaluate Day
                            </Text>
                            <Text className="text-slate-400 text-sm">
                                {dayjs(date).format('dddd, MMMM D, YYYY')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={onClose}
                            className="bg-slate-800 p-2 rounded-full"
                        >
                            <Ionicons name="close" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    <ForecastSection date={date} />

                    <Text className="text-indigo-200 mb-3 font-medium">How was your day?</Text>

                    <View className="flex-row justify-between mb-6">
                        {MOOD_OPTIONS.map((option) => {
                            const isSelected = selectedMood === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    onPress={() => setSelectedMood(option.value)}
                                    className="items-center justify-center w-12 h-12 rounded-full border-2"
                                    style={{
                                        backgroundColor: option.color,
                                        borderColor: isSelected ? 'white' : 'transparent',
                                        opacity: isSelected ? 1 : 0.8,
                                        transform: [{ scale: isSelected ? 1.1 : 1 }]
                                    }}
                                >
                                    <Ionicons name={option.icon as any} size={24} color="white" />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {selectedMood && (
                         <Text className="text-center text-white font-bold mb-4" style={{ color: MOOD_OPTIONS[selectedMood - 1].color }}>
                            {MOOD_OPTIONS[selectedMood - 1].label}
                        </Text>
                    )}

                    <Text className="text-indigo-200 mb-2 font-medium">Day Note</Text>
                    <TextInput
                        className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium min-h-[100px] mb-6"
                        value={note}
                        onChangeText={setNote}
                        placeholder="What happened today? Any reflections?"
                        placeholderTextColor="#64748b"
                        multiline
                        textAlignVertical="top"
                    />

                    {activeHabits.length > 0 && (
                        <View className="mb-6">
                            <Text className="text-indigo-200 mb-2 font-medium">Daily Checks</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {activeHabits.map(habit => {
                                    const isChecked = checkedHabits[habit.id];
                                    return (
                                        <TouchableOpacity
                                            key={habit.id}
                                            onPress={() => setCheckedHabits(prev => ({ ...prev, [habit.id]: !prev[habit.id] }))}
                                            className={`flex-row items-center px-3 py-2 rounded-xl border border-slate-700 ${
                                                isChecked ? 'bg-indigo-900/50 border-indigo-500' : 'bg-slate-800'
                                            }`}
                                        >
                                            <Ionicons 
                                                name={habit.icon as any} 
                                                size={18} 
                                                color={isChecked ? habit.color : '#64748b'} 
                                            />
                                            <Text className={`ml-2 font-medium ${isChecked ? 'text-white' : 'text-slate-400'}`}>
                                                {habit.title}
                                            </Text>
                                            {isChecked && (
                                                <View className="ml-2 bg-indigo-500 rounded-full p-0.5">
                                                    <Ionicons name="checkmark" size={10} color="white" />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 bg-slate-800 p-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={selectedMood === null}
                            className={`flex-1 p-3 rounded-xl items-center ${
                                selectedMood !== null ? 'bg-indigo-600' : 'bg-slate-700 opacity-50'
                            }`}
                        >
                            <Text className="text-white font-semibold">Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
