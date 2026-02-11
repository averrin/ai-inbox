import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseListItem } from '../ui/BaseListItem';
import { ActionButton } from '../ui/ActionButton';
import { RichTask } from '../../utils/taskParser';
import { useSettingsStore } from '../../store/settings';
import { REMINDER_PROPERTY_KEY } from '../../services/reminderService';
import { TaskStatusIcon } from '../ui/TaskStatusIcon';

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
    isSelected
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
        <View className="flex-row flex-wrap gap-1 mt-1 items-center">
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
                        className="bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600/50 flex-row"
                        style={customStyle}
                    >
                        {key === 'context' ? (
                            <Text className="text-slate-200 text-[10px]" style={textStyle}>@{value}</Text>
                        ) : (
                            <>
                                <Text className="text-slate-400 text-[10px] mr-1" style={textStyle}>{key}:</Text>
                                <Text className="text-slate-200 text-[10px]" style={textStyle}>{value}</Text>
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
                    <View 
                        key={`tag-${tag}`} 
                        className="bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-500/30"
                        style={customStyle}
                    >
                        <Text className="text-indigo-300 text-[10px]" style={textStyle}>#{tag}</Text>
                    </View>
                );
            })}
        </View>
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

    return (
        <View className="flex-row items-start relative">
            {showGuide && (
                <View
                    style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 40, alignItems: 'center', justifyContent: 'center' }}
                    pointerEvents="none"
                >
                    <View
                        className={`absolute w-0.5 bg-indigo-500/30 ${isFirstInFile ? 'top-6' : 'top-0'} ${isLastInFile ? 'bottom-6' : 'bottom-0'}`}
                        style={{ left: 19 }}
                    />

                    {isFirstInFile && fileName && (
                        <View
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: -40,
                                width: 120,
                                height: 20,
                                transform: [{ translateY: -10 }, { rotate: '90deg' }],
                                zIndex: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text
                                className="text-slate-500 text-[8px] font-bold uppercase tracking-[2px] text-center"
                                numberOfLines={1}
                            >
                                {fileName}
                            </Text>
                        </View>
                    )}
                </View>
            )}
            <View className={`flex-1 ${showGuide ? 'pl-10' : ''}`}>
                <BaseListItem
                    leftIcon={leftIcon}
                    selectionComponent={selectionComponent}
                    hideIconBackground={true}
                    title={
                        <Text 
                            className={`text-sm font-medium ${task.status === 'x' || task.status === '-' ? 'text-slate-500 line-through' : 'text-white'}`}
                            numberOfLines={1}
                        >
                            {task.title}
                        </Text>
                    }
                    subtitle={subtitle || (Object.keys(task.properties).length > 0 || task.tags.length > 0 ? metadataSubtitle : undefined)}
                    onPress={selectionMode ? onToggle : onEdit}
                    onLongPress={handleBodyLongPress}
                    rightActions={rightActions}
                    containerStyle={task.status === 'x' || task.status === '-' ? { opacity: 0.8 } : undefined}
                />
            </View>
        </View>
    );
}
