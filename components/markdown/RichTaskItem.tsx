import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseListItem } from '../ui/BaseListItem';
import { ActionButton } from '../ui/ActionButton';
import { RichTask } from '../../utils/taskParser';
import { useSettingsStore } from '../../store/settings';
import { REMINDER_PROPERTY_KEY } from '../../services/reminderService';

interface RichTaskItemProps {
    task: RichTask;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onUpdate: (updatedTask: RichTask) => void;
    onStatusLongPress?: () => void;
    onPriorityLongPress?: () => void;
    fileName?: string;
    subtitle?: string | React.ReactNode;
    showGuide?: boolean;
    isFirstInFile?: boolean;
    isLastInFile?: boolean;
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
    isLastInFile
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

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'x':
                return { icon: 'checkbox' as const, color: '#6366f1', label: 'Completed' };
            case '/':
                return { icon: 'play-circle-outline' as const, color: '#818cf8', label: 'In Progress' };
            case '-':
                return { icon: 'close-circle-outline' as const, color: '#94a3b8', label: 'Abandoned' };
            case '?':
                return { icon: 'help-circle-outline' as const, color: '#fbbf24', label: 'Planned' };
            case '>':
                return { icon: 'arrow-forward-circle-outline' as const, color: '#6366f1', label: 'Delayed' };
            default:
                return { icon: 'square-outline' as const, color: '#94a3b8', label: 'Pending' };
        }
    };

    const statusConfig = getStatusConfig(task.status);

    const leftIcon = (
        <TouchableOpacity 
            onPress={onToggle}
            onLongPress={handleStatusLongPress}
            delayLongPress={500}
            className="w-full h-full items-center justify-center"
        >
            <Ionicons 
                name={statusConfig.icon} 
                size={24} 
                color={statusConfig.color} 
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
            {Object.entries(task.properties).map(([key, value]) => {
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
                        key={key} 
                        className="bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600/50 flex-row"
                        style={customStyle}
                    >
                        <Text className="text-slate-400 text-[10px] mr-1" style={textStyle}>{key}:</Text>
                        <Text className="text-slate-200 text-[10px]" style={textStyle}>{value}</Text>
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
                        key={tag} 
                        className="bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-500/30"
                        style={customStyle}
                    >
                        <Text className="text-indigo-300 text-[10px]" style={textStyle}>#{tag}</Text>
                    </View>
                );
            })}
        </View>
    );

    const rightActions = (
        <>
            <ActionButton onPress={onEdit} icon="pencil" variant="neutral" />
            <ActionButton onPress={onDelete} icon="trash-outline" variant="danger" />
        </>
    );

    return (
        <View className="relative">
            {showGuide && (
                <View 
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 20 }}
                    pointerEvents="none"
                >
                    <View 
                        className={`absolute left-[-10px] w-0.5 bg-indigo-500/50 ${isFirstInFile ? 'top-6' : 'top-0'} ${isLastInFile ? 'bottom-6' : 'bottom-0'}`}
                    />

                    {isFirstInFile && fileName && (
                        <View 
                            style={{ 
                                position: 'absolute',
                                top: 94,
                                left: -84,
                                width: 160,
                                height: 20,
                                transform: [{ rotate: '90deg' }],
                                zIndex: 10,
                                alignItems: 'center', 
                                flexDirection: 'row', 
                            }}
                        >
                            <Text 
                                className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-left w-full pl-2"
                                numberOfLines={1}
                            >
                                {fileName}
                            </Text>
                        </View>
                    )}
                </View>
            )}
            <BaseListItem
                leftIcon={leftIcon}
                title={
                    <Text 
                        className={`text-sm font-medium ${task.status === 'x' || task.status === '-' ? 'text-slate-500 line-through' : 'text-white'}`}
                        numberOfLines={1}
                    >
                        {task.title}
                    </Text>
                }
                subtitle={subtitle || (Object.keys(task.properties).length > 0 || task.tags.length > 0 ? metadataSubtitle : undefined)}
                onPress={onEdit}
                onLongPress={handleBodyLongPress}
                rightActions={rightActions}
                containerStyle={task.status === 'x' || task.status === '-' ? { opacity: 0.8 } : undefined}
            />
        </View>
    );
}
