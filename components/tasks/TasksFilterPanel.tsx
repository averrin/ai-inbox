import React from 'react';
import { View, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TasksFilterPanelProps {
    search: string;
    setSearch: (text: string) => void;
    showCompleted: boolean;
    setShowCompleted: (show: boolean) => void;
}

export function TasksFilterPanel({
    search,
    setSearch,
    showCompleted,
    setShowCompleted,
}: TasksFilterPanelProps) {
    return (
        <View className="bg-slate-900 border-b border-slate-800 p-4">
            <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-2 mb-3">
                <Ionicons name="search-outline" size={20} color="#64748b" />
                <TextInput
                    className="flex-1 ml-2 text-white font-medium"
                    placeholder="Search tasks..."
                    placeholderTextColor="#64748b"
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={20} color="#64748b" />
                    </TouchableOpacity>
                )}
            </View>

            <View className="flex-row gap-2">
                <TouchableOpacity
                    onPress={() => setShowCompleted(false)}
                    className={`px-4 py-2 rounded-lg border ${!showCompleted ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
                >
                    <Text className={`font-semibold ${!showCompleted ? 'text-white' : 'text-slate-400'}`}>
                        Pending
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setShowCompleted(true)}
                    className={`px-4 py-2 rounded-lg border ${showCompleted ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
                >
                    <Text className={`font-semibold ${showCompleted ? 'text-white' : 'text-slate-400'}`}>
                        Completed
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
