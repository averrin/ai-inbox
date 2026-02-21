import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../ui/design-tokens';
import { showError } from '../../utils/alert';

interface TasksFilterPanelProps {
    search: string;
    setSearch: (text: string) => void;
    showCompleted: boolean;
    setShowCompleted: (show: boolean) => void;
    onRemoveCompleted: () => void;
    onMergeTasks: () => void;
    sortBy: string;
    onToggleSort: () => void;
}

export function TasksFilterPanel({
    search,
    setSearch,
    showCompleted,
    setShowCompleted,
    onRemoveCompleted,
    onMergeTasks,
    sortBy,
    onToggleSort,
}: TasksFilterPanelProps) {
    const [showMenu, setShowMenu] = useState(false);
    return (
        <View className="p-4 pb-2 bg-transparent border-b border-border">
            <View className="flex-row items-center bg-surface rounded-xl px-4 py-2 mb-3">
                <Ionicons name="search-outline" size={20} color={Colors.secondary} />
                <TextInput
                    className="flex-1 ml-2 text-white font-medium"
                    placeholder="Search tasks..."
                    placeholderTextColor={Colors.secondary}
                    value={search}
                    onChangeText={setSearch}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={20} color={Colors.secondary} />
                    </TouchableOpacity>
                )}
            </View>

            <View className="flex-row items-center justify-between">
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => setShowCompleted(false)}
                        className={`px-4 py-2 rounded-lg border ${!showCompleted ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                    >
                        <Text className={`font-semibold ${!showCompleted ? 'text-white' : 'text-text-tertiary'}`}>
                            Pending
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowCompleted(true)}
                        className={`px-4 py-2 rounded-lg border ${showCompleted ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                    >
                        <Text className={`font-semibold ${showCompleted ? 'text-white' : 'text-text-tertiary'}`}>
                            Completed
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onToggleSort}
                        className="flex-row items-center px-3 py-2 rounded-lg border border-border bg-surface"
                    >
                        <Ionicons name="swap-vertical" size={16} color="#818cf8" />
                        <Text className="text-text-secondary text-xs font-bold ml-1.5 uppercase tracking-tight">
                            {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Action Menu Container */}
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity 
                        onPress={() => {
                            Linking.openURL('obsidian://open').catch(() => {
                                showError('Error', 'Obsidian app not found or could not be opened.');
                            });
                        }}
                        className="bg-surface p-2 rounded-lg border border-border"
                    >
                        <Ionicons name="book-outline" size={20} color="#818cf8" />
                    </TouchableOpacity>

                    <TouchableOpacity 
                        onPress={() => setShowMenu(!showMenu)}
                        className="bg-surface p-2 rounded-lg border border-border"
                    >
                        <Ionicons name="ellipsis-vertical" size={20} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                </View>

                    {showMenu && (
                        <View 
                            className="absolute right-0 top-12 bg-surface border border-border rounded-xl shadow-2xl min-w-[180px] overflow-hidden"
                            style={{ elevation: 5, zIndex: 1000 }}
                        >
                            <TouchableOpacity 
                                onPress={() => {
                                    setShowMenu(false);
                                    onMergeTasks();
                                }}
                                className="flex-row items-center p-4 border-b border-border active:bg-surface-highlight"
                            >
                                <Ionicons name="document-text-outline" size={18} color="#818cf8" />
                                <Text className="text-text-primary ml-3 font-medium">Merge to File</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => {
                                    setShowMenu(false);
                                    onRemoveCompleted();
                                }}
                                className="flex-row items-center p-4 border-b border-border active:bg-surface-highlight"
                            >
                                <Ionicons name="trash-outline" size={18} color={Colors.error} />
                                <Text className="text-error ml-3 font-medium">Clear Completed</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                onPress={() => setShowMenu(false)}
                                className="p-4 active:bg-surface-highlight"
                            >
                                <Text className="text-text-tertiary font-medium">Close Menu</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
    );
}
