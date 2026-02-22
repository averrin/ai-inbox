import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../ui/design-tokens';
import { showError } from '../../utils/alert';
import { AppButton } from '../ui/AppButton';

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
                    <AppButton
                        title="Pending"
                        variant="ghost"
                        size="sm"
                        rounding="md"
                        selected={!showCompleted}
                        onPress={() => setShowCompleted(false)}
                    />
                    <AppButton
                        title="Completed"
                        variant="ghost"
                        size="sm"
                        rounding="md"
                        selected={showCompleted}
                        onPress={() => setShowCompleted(true)}
                    />
                    <AppButton
                        icon="swap-vertical"
                        title={sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                        variant="ghost"
                        size="xs"
                        rounding="md"
                        onPress={onToggleSort}
                        color="#818cf8"
                        textStyle={{ textTransform: 'uppercase', letterSpacing: -0.5 }}
                    />
                </View>

                {/* Action Menu Container */}
                <View className="flex-row items-center gap-2">
                    <AppButton
                        icon="book-outline"
                        variant="ghost"
                        size="sm"
                        rounding="md"
                        color="#818cf8"
                        onPress={() => {
                            Linking.openURL('obsidian://open').catch(() => {
                                showError('Error', 'Obsidian app not found or could not be opened.');
                            });
                        }}
                    />
                    <AppButton
                        icon="ellipsis-vertical"
                        variant="ghost"
                        size="sm"
                        rounding="md"
                        onPress={() => setShowMenu(!showMenu)}
                    />
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
