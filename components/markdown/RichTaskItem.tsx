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
    fileName,
    subtitle,
    showGuide,
    isFirstInFile,
    isLastInFile
}: RichTaskItemProps) {
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
        <View className="relative">
            {showGuide && (
                <View 
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 20 }}
                    pointerEvents="none"
                >
                    {/* The 2px Guide Line */}
                    <View 
                        className={`absolute left-[-10px] w-0.5 bg-indigo-500/50 ${isFirstInFile ? 'top-6' : 'top-0'} ${isLastInFile ? 'bottom-6' : 'bottom-0'}`}
                    />

                    {/* The File Label */}
                    {isFirstInFile && fileName && (
                        <View 
                            style={{ 
                                position: 'absolute',
                                // Center of label should be at x=-10 (guide line)
                                // We want the TOP of the rotated text to start around y=24 (top-6)
                                // Width 160px (w-40), Height 20px (h-5)
                                // Pivot is center (80, 10)
                                // Visual Top = CenterY - 80 = 24 => CenterY = 104
                                // Actual Top = CenterY - 10 = 94
                                top: 94,
                                // Visual CenterX = CenterX = -10
                                // Actual Left = CenterX - 80 = -90
                                left: -84,
                                width: 160,
                                height: 20,
                                transform: [{ rotate: '90deg' }],
                                zIndex: 10,
                                alignItems: 'center', // Center text vertically in the strip
                                flexDirection: 'row', // Ensure text aligns
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
                rightActions={rightActions}
                containerStyle={task.status === 'x' || task.status === '-' ? { opacity: 0.8 } : undefined}
            />
        </View>
    );
}
