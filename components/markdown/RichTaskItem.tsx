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
import { Colors, Palette } from '../ui/design-tokens';

const FILE_COLORS = [
    Colors.error, // red-500
    Colors.busy, // orange-500
    Colors.warning, // yellow-500
    Colors.success, // green-500
    Palette[11], // cyan-500
    Colors.primary, // blue-500
    Palette[15], // violet-500
    Palette[3], // fuchsia-500
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
    onReschedule?: () => void;
    isHighlighted?: boolean;
    highlightColor?: string;
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
    onTagPress,
    onReschedule,
    isHighlighted,
    highlightColor
}: RichTaskItemProps) {
    const { tagConfig, propertyConfig } = useSettingsStore();

    const highlightStyle = isHighlighted ? {
        borderWidth: 2,
        borderColor: highlightColor || '#818cf8',
        // backgroundColor: Colors.transparent,
        shadowColor: highlightColor || '#818cf8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 20,
    } : undefined;

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
                    className="bg-surface-highlight px-1.5 py-0.5 rounded border border-primary flex-row items-center"
                    style={{ backgroundColor: '#818cf833', borderColor: '#818cf866' }}
                >
                    <Ionicons name="calendar-outline" size={10} color="#818cf8" style={{ marginRight: 4 }} />
                    <Text className="text-text-secondary text-[10px] font-medium" style={{ color: '#818cf8' }} numberOfLines={1}>
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
                        className="bg-surface-highlight/50 px-1.5 py-0.5 rounded border border-border flex-row items-center"
                        style={customStyle}
                    >
                        {key === 'context' ? (
                            <Text className="text-text-primary text-[10px]" style={textStyle}>@{value}</Text>
                        ) : (
                            <>
                                <Text className="text-text-tertiary text-[10px] mr-1" style={textStyle}>{key}:</Text>
                                <Text className="text-text-primary text-[10px]" style={textStyle}>
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
                        className="bg-surface-highlight px-1.5 py-0.5 rounded border border-primary"
                        style={customStyle}
                    >
                        <Text className="text-text-secondary text-[10px]" style={textStyle}>#{tag}</Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );

    const rightActions = (onEdit || onDelete || onReschedule) ? (
        <>
            {onReschedule && <ActionButton onPress={onReschedule} icon="time-outline" variant="neutral" />}
            {onEdit && <ActionButton onPress={onEdit} icon="pencil" variant="neutral" />}
            {onDelete && <ActionButton onPress={onDelete} icon="trash-outline" variant="danger" />}
        </>
    ) : null;

    const selectionComponent = selectionMode ? (
        <View className="pl-1">
            <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={22}
                color={isSelected ? "#818cf8" : Colors.secondary}
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
                        className={`text-sm font-medium ${task.status === 'x' || task.status === '-' ? 'text-secondary line-through' : 'text-white'} flex-shrink`}
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
            containerStyle={[
                task.status === 'x' || task.status === '-' ? { opacity: 0.8 } : undefined,
                highlightStyle
            ]}
        />
    );
}
