import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseListItem } from '../ui/BaseListItem';
import { ActionButton } from '../ui/ActionButton';
import { RichTask } from '../../utils/taskParser';
import { useSettingsStore } from '../../store/settings';
import { REMINDER_PROPERTY_KEY } from '../../services/reminderService';
import { TaskStatusIcon } from '../ui/TaskStatusIcon';
import dayjs from 'dayjs';

const FILE_COLORS = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#8b5cf6', // violet-500
    '#d946ef', // fuchsia-500
];

function getColorForFilename(filename: string): string {
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
        hash = filename.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % FILE_COLORS.length;
    return FILE_COLORS[index];
}

interface RichTaskItemProps {
    task: RichTask;
    onToggle: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onUpdate: (updatedTask: RichTask) => void;
    onStatusLongPress?: () => void;
    onPriorityLongPress?: () => void;
    fileName?: string;
    subtitle?: string | React.ReactNode;
    showGuide?: boolean;
    isFirstInFile?: boolean;
    isLastInFile?: boolean;
    selectionMode?: boolean;
    isSelected?: boolean;
    onTagPress?: (tag: string) => void;
}

export function RichTaskItem({ 
    task, 
    onToggle, 
    onEdit, 
    onDelete, 
    onUpdate,
    onStatusLongPress,
    onPriorityLongPress,
    fileName,
    subtitle,
    showGuide,
    isFirstInFile,
    isLastInFile,
    selectionMode,
    isSelected,
    onTagPress
}: RichTaskItemProps) {
    const { tagConfig, propertyConfig } = useSettingsStore();

    const updateStatus = (newStatus: string) => {
        onUpdate({ 
            ...task, 
            status: newStatus, 
            completed: newStatus === 'x' 
        });
    };

    const handleStatusLongPress = () => {
        if (onStatusLongPress) {
            onStatusLongPress();
        }
    };

    const updatePriority = (priority?: string) => {
        const newProps = { ...task.properties };
        if (priority) {
            newProps.priority = priority;
        } else {
            delete newProps.priority;
        }
        onUpdate({ ...task, properties: newProps });
    };

    const handleBodyLongPress = () => {
        if (onPriorityLongPress) {
            onPriorityLongPress();
        }
    };

    const leftIcon = (
        <TouchableOpacity 
            onPress={onToggle}
            onLongPress={handleStatusLongPress}
            delayLongPress={500}
            className="items-center justify-center p-2"
        >
            <TaskStatusIcon 
                status={task.status} 
                size={24} 
            />
        </TouchableOpacity>
    );

    const metadataSubtitle = (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 4, alignItems: 'center' }}
            style={{ marginTop: 4, height: 22 }} // Fixed height for one line
        >
            {task.properties[REMINDER_PROPERTY_KEY] && (
                <View className="mr-1">
                    <Ionicons name="alarm" size={14} color="#fbbf24" />
                </View>
            )}
            {task.properties.event_id && (
                <View 
                    className="bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-500/30 flex-row items-center"
                    style={{ backgroundColor: '#818cf833', borderColor: '#818cf866' }}
                >
                    <Ionicons name="calendar-outline" size={10} color="#818cf8" style={{ marginRight: 4 }} />
                    <Text className="text-indigo-300 text-[10px] font-medium" style={{ color: '#818cf8' }} numberOfLines={1}>
                        {task.properties.event_title || 'Event'}
                    </Text>
                </View>
            )}
            {Object.entries(task.properties).map(([key, value]) => {
                if (key === 'event_id' || key === 'event_title') return null;
                const config = propertyConfig[key];
                if (config?.hidden) return null;

                const valStr = String(value);
                const valueConfig = config?.valueConfigs?.[valStr];
                
                const activeColor = valueConfig?.color || config?.color;

                const customStyle = activeColor ? {
                    backgroundColor: `${activeColor}33`, 
                    borderColor: `${activeColor}66`, 
                } : undefined;
                const textStyle = activeColor ? { color: activeColor } : undefined;

                return (
                    <View 
                        key={`prop-${key}`} 
                        className="bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600/50 flex-row items-center"
                        style={customStyle}
                    >
                        {key === 'context' ? (
                            <Text className="text-slate-200 text-[10px]" style={textStyle}>@{value}</Text>
                        ) : (
                            <>
                                <Text className="text-slate-400 text-[10px] mr-1" style={textStyle}>{key}:</Text>
                                <Text className="text-slate-200 text-[10px]" style={textStyle}>
                                    {key === 'date' && String(value) === dayjs().format('YYYY-MM-DD') ? 'Today' : String(value)}
                                </Text>
                            </>
                        )}
                    </View>
                );
            })}
            {task.tags.map(tag => {
                const config = tagConfig[tag];
                if (config?.hidden) return null;

                const customStyle = config?.color ? {
                    backgroundColor: `${config.color}33`, 
                    borderColor: `${config.color}66`, 
                } : undefined;
                const textStyle = config?.color ? { color: config.color } : undefined;

                return (
                    <TouchableOpacity
                        key={`tag-${tag}`} 
                        onPress={() => onTagPress?.(tag)}
                        className="bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-500/30"
                        style={customStyle}
                    >
                        <Text className="text-indigo-300 text-[10px]" style={textStyle}>#{tag}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    const rightActions = (onEdit || onDelete) ? (
        <>
            {onEdit && <ActionButton onPress={onEdit} icon="pencil" variant="neutral" />}
            {onDelete && <ActionButton onPress={onDelete} icon="trash-outline" variant="danger" />}
        </>
    ) : null;

    const selectionComponent = selectionMode ? (
        <View className="pl-1">
            <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={22}
                color={isSelected ? "#818cf8" : "#64748b"}
            />
        </View>
    ) : null;

    const fileColor = fileName ? getColorForFilename(fileName) : undefined;

    return (
        <BaseListItem
            leftIcon={leftIcon}
            selectionComponent={selectionComponent}
            hideIconBackground={true}
            title={
                <View className="flex-row items-center">
                    <Text
                        className={`text-sm font-medium ${task.status === 'x' || task.status === '-' ? 'text-slate-500 line-through' : 'text-white'} flex-shrink`}
                        numberOfLines={1}
                    >
                        {task.title}
                    </Text>
                    {fileName && fileColor && (
                        <View
                            className="ml-2 w-2 h-2 rounded-full"
                            style={{ backgroundColor: fileColor }}
                        />
                    )}
                </View>
            }
            subtitle={subtitle || (Object.keys(task.properties).length > 0 || task.tags.length > 0 ? metadataSubtitle : undefined)}
            onPress={selectionMode ? onToggle : onEdit}
            onLongPress={handleBodyLongPress}
            rightActions={rightActions}
            containerStyle={task.status === 'x' || task.status === '-' ? { opacity: 0.8 } : undefined}
        />
    );
}
