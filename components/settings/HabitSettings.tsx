import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { useHabitStore, HabitDefinition } from '../../store/habitStore';
import { HabitItem } from '../ui/calendar/components/HabitItem';
import { HabitModal } from '../HabitModal';

export function HabitSettings() {
    const { habits, addHabit, updateHabit, deleteHabit, toggleHabit } = useHabitStore();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingHabit, setEditingHabit] = useState<HabitDefinition | undefined>(undefined);

    const handleEdit = (habit: HabitDefinition) => {
        setEditingHabit(habit);
        setIsModalVisible(true);
    };

    const handleCreate = () => {
        setEditingHabit(undefined);
        setIsModalVisible(true);
    };

    const handleSave = (habitData: Omit<HabitDefinition, 'id' | 'isEnabled'>) => {
        if (editingHabit) {
            updateHabit(editingHabit.id, habitData);
        } else {
            addHabit(habitData);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            "Delete Check",
            "Are you sure you want to delete this check? Past data will be kept but hidden.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteHabit(id) }
            ]
        );
    };

    return (
        <View>
            <Card>
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-indigo-200 font-semibold">Checks</Text>
                    <TouchableOpacity
                        onPress={handleCreate}
                        className="bg-indigo-600 px-3 py-1.5 rounded-lg flex-row items-center"
                    >
                        <Ionicons name="add" size={16} color="white" />
                        <Text className="text-white font-bold ml-1">New Check</Text>
                    </TouchableOpacity>
                </View>

                {habits.length === 0 ? (
                    <View className="items-center py-8">
                        <Ionicons name="checkmark-circle-outline" size={48} color="#475569" />
                        <Text className="text-slate-500 mt-2 text-center">
                            No checks defined yet.{'\n'}Add daily habits to track.
                        </Text>
                    </View>
                ) : (
                    <View className="gap-2">
                        {habits.map(habit => (
                            <HabitItem
                                key={habit.id}
                                habit={habit}
                                onEdit={() => handleEdit(habit)}
                                onDelete={() => handleDelete(habit.id)}
                                onToggle={() => toggleHabit(habit.id)}
                            />
                        ))}
                    </View>
                )}
            </Card>

            <HabitModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onSave={handleSave}
                initialData={editingHabit}
            />
        </View>
    );
}
