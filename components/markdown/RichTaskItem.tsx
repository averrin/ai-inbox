import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseListItem } from '../ui/BaseListItem';
import { ActionButton } from '../ui/ActionButton';
import { RichTask } from '../../utils/taskParser';

interface RichTaskItemProps {
    task: RichTask;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export function RichTaskItem({ task, onToggle, onEdit, onDelete }: RichTaskItemProps) {
    const leftIcon = (
        <TouchableOpacity 
            onPress={onToggle}
            className="w-full h-full items-center justify-center"
        >
            <Ionicons 
                name={task.completed ? "checkbox" : "square-outline"} 
                size={24} 
                color={task.completed ? "#6366f1" : "#94a3b8"} 
            />
        </TouchableOpacity>
    );

    const subtitle = (
        <View className="flex-row flex-wrap gap-1 mt-1">
            {Object.entries(task.properties).map(([key, value]) => (
                <View key={key} className="bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600/50 flex-row">
                    <Text className="text-slate-400 text-[10px] mr-1">{key}:</Text>
                    <Text className="text-slate-200 text-[10px]">{value}</Text>
                </View>
            ))}
            {task.tags.map(tag => (
                <View key={tag} className="bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-500/30">
                    <Text className="text-indigo-300 text-[10px]">#{tag}</Text>
                </View>
            ))}
        </View>
    );

    const rightActions = (
        <>
            <ActionButton onPress={onEdit} icon="pencil" variant="neutral" />
            <ActionButton onPress={onDelete} icon="trash-outline" variant="danger" />
        </>
    );

    return (
        <BaseListItem
            leftIcon={leftIcon}
            title={
                <Text 
                    className={`text-sm font-medium ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}
                    numberOfLines={1}
                >
                    {task.title}
                </Text>
            }
            subtitle={(Object.keys(task.properties).length > 0 || task.tags.length > 0) ? subtitle : undefined}
            onPress={onEdit}
            rightActions={rightActions}
            containerStyle={task.completed ? { opacity: 0.8 } : undefined}
        />
    );
}
