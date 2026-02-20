import React, { useMemo, useState } from 'react';
import { View, FlatList, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TaskWithSource } from '../../store/tasks';
import { RichTaskItem } from '../markdown/RichTaskItem';
import { SelectionSheet, SelectionOption } from '../ui/SelectionSheet';
import { RichTask } from '../../utils/taskParser';
import { Colors, Palette } from '../ui/design-tokens';

interface TasksListProps {
    tasks: TaskWithSource[]; // Filtered and sorted tasks

    isLoading: boolean;
    isRefreshing: boolean;
    onRefresh: () => void;

    // CRUD Actions (Optional in selection mode)
    onToggle?: (task: TaskWithSource) => void;
    onEdit?: (task: TaskWithSource) => void;
    onDelete?: (task: TaskWithSource) => void;
    onUpdate?: (updatedTask: RichTask, originalTask: TaskWithSource) => void;

    // Selection Mode
    selectionMode?: boolean;
    selectedIds?: string[]; // Use fileUri + originalLine as unique ID
    onToggleSelection?: (task: TaskWithSource) => void;
    onTagPress?: (tag: string) => void;
}

const STATUS_OPTIONS: SelectionOption[] = [
    { id: ' ', label: 'Pending', icon: 'square-outline', color: Colors.text.tertiary },
    { id: '/', label: 'In Progress', icon: 'play-circle-outline', color: '#818cf8' },
    { id: 'x', label: 'Done', icon: 'checkbox', color: Colors.success },
    { id: '-', label: "Won't Do", icon: 'close-circle-outline', color: Colors.text.tertiary },
    { id: '?', label: 'Planned', icon: 'help-circle-outline', color: '#fbbf24' },
    { id: '>', label: 'Delayed', icon: 'arrow-forward-circle-outline', color: Palette[14] },
];

const PRIORITY_OPTIONS: SelectionOption[] = [
    { id: 'high', label: 'High Priority', icon: 'arrow-up-circle', color: Colors.error },
    { id: 'medium', label: 'Medium Priority', icon: 'remove-circle', color: Palette[5] },
    { id: 'low', label: 'Low Priority', icon: 'arrow-down-circle', color: Colors.success },
    { id: 'clear', label: 'Clear Priority', icon: 'close-circle', destructive: true },
];

export function TasksList({
    tasks,
    isLoading,
    isRefreshing,
    onRefresh,
    onToggle,
    onEdit,
    onDelete,
    onUpdate,
    selectionMode = false,
    selectedIds = [],
    onToggleSelection,
    onTagPress
}: TasksListProps) {
    const insets = useSafeAreaInsets();
    const [activeTaskForSheet, setActiveTaskForSheet] = useState<TaskWithSource | null>(null);
    const [isStatusSheetVisible, setIsStatusSheetVisible] = useState(false);
    const [isPrioritySheetVisible, setIsPrioritySheetVisible] = useState(false);

    const tasksWithGroups = useMemo(() => {
        return tasks.map((task, index) => {
            const isFirstInFile = index === 0 || tasks[index - 1].filePath !== task.filePath;
            const isLastInFile = index === tasks.length - 1 || tasks[index + 1].filePath !== task.filePath;
            const isSingleInFile = isFirstInFile && isLastInFile;
            return {
                ...task,
                isFirstInFile,
                isLastInFile,
                showGuide: !isSingleInFile
            };
        });
    }, [tasks]);

    // Handle updates from sheets
    const handleStatusSelect = (option: SelectionOption) => {
        if (activeTaskForSheet && onUpdate) {
            const newStatus = option.id;
            const updatedTask: RichTask = {
                ...activeTaskForSheet,
                status: newStatus,
                completed: newStatus === 'x'
            };
            onUpdate(updatedTask, activeTaskForSheet);
        }
    };

    const handlePrioritySelect = (option: SelectionOption) => {
        if (activeTaskForSheet && onUpdate) {
            const newProps = { ...activeTaskForSheet.properties };
            if (option.id === 'clear') {
                delete newProps.priority;
            } else {
                newProps.priority = option.id;
            }
            const updatedTask: RichTask = { ...activeTaskForSheet, properties: newProps };
            onUpdate(updatedTask, activeTaskForSheet);
        }
    };

    return (
        <View className="flex-1">
            <FlatList
                data={tasksWithGroups}
                keyExtractor={(item, index) => `${item.filePath}-${index}`}
                renderItem={({ item }) => {
                    const uniqueId = item.fileUri + item.originalLine;
                    const isSelected = selectedIds.includes(uniqueId);

                    return (
                        <RichTaskItem
                            task={item}
                            onToggle={() => selectionMode ? onToggleSelection?.(item) : onToggle?.(item)}
                            onEdit={!selectionMode ? () => onEdit?.(item) : undefined}
                            onDelete={!selectionMode ? () => onDelete?.(item) : undefined}
                            onUpdate={(updated) => onUpdate?.(updated, item)}
                            fileName={item.fileName}
                            showGuide={item.showGuide}
                            isFirstInFile={item.isFirstInFile}
                            isLastInFile={item.isLastInFile}
                            selectionMode={selectionMode}
                            isSelected={isSelected}
                            onTagPress={!selectionMode ? onTagPress : undefined}
                            // Disable long press actions in selection mode
                            onStatusLongPress={!selectionMode ? () => {
                                setActiveTaskForSheet(item);
                                setIsStatusSheetVisible(true);
                            } : undefined}
                            onPriorityLongPress={!selectionMode ? () => {
                                setActiveTaskForSheet(item);
                                setIsPrioritySheetVisible(true);
                            } : undefined}
                        />
                    );
                }}
                contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 80 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Text className="text-secondary italic mb-4">No tasks found matching criteria.</Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={onRefresh}
                        tintColor="#818cf8"
                    />
                }
            />

            {!selectionMode && (
                <>
                    <SelectionSheet
                        visible={isStatusSheetVisible}
                        title="Change Status"
                        options={STATUS_OPTIONS}
                        onSelect={handleStatusSelect}
                        onClose={() => setIsStatusSheetVisible(false)}
                    />
                    <SelectionSheet
                        visible={isPrioritySheetVisible}
                        title="Set Priority"
                        options={PRIORITY_OPTIONS}
                        onSelect={handlePrioritySelect}
                        onClose={() => setIsPrioritySheetVisible(false)}
                    />
                </>
            )}
        </View>
    );
}
