import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TasksFilterPanelProps {
    search: string;
    setSearch: (text: string) => void;
    showCompleted: boolean;
    setShowCompleted: (show: boolean) => void;
    onRemoveCompleted: () => void;
}

export function TasksFilterPanel({
    search,
    setSearch,
    showCompleted,
    setShowCompleted,
    onRemoveCompleted,
}: TasksFilterPanelProps) {
    const [showMenu, setShowMenu] = useState(false);
    return (
        <View className="p-4 pb-2 bg-transparent border-b border-slate-700">
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

            <View className="flex-row items-center justify-between">
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

                {/* Action Menu Container */}
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity 
                        onPress={() => {
                            Linking.openURL('obsidian://open').catch(() => {
                                Alert.alert('Error', 'Obsidian app not found or could not be opened.');
                            });
                        }}
                        className="bg-slate-800 p-2 rounded-lg border border-slate-700"
                    >
                        <Ionicons name="book-outline" size={20} color="#818cf8" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setShowMenu(!showMenu)}
                        className="bg-slate-800 p-2 rounded-lg border border-slate-700"
                    >
                        <Ionicons name="ellipsis-vertical" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                    {showMenu && (
                        <View 
                            className="absolute right-0 top-12 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl min-w-[160px] overflow-hidden"
                            style={{ elevation: 5, zIndex: 1000 }}
                        >
                            <TouchableOpacity 
                                onPress={() => {
                                    setShowMenu(false);
                                    onRemoveCompleted();
                                }}
                                className="flex-row items-center p-4 border-b border-slate-700 active:bg-slate-700"
                            >
                                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                <Text className="text-red-400 ml-3 font-medium">Clear Completed</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={() => setShowMenu(false)}
                                className="p-4 active:bg-slate-700"
                            >
                                <Text className="text-slate-400 font-medium">Close Menu</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
    );
}
