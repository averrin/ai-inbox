import React from 'react'
import { View, Text, TouchableOpacity, Switch } from 'react-native'
import { ActionButton } from '../../ActionButton'
import { SettingsListItem } from '../../SettingsListItem'
import { Ionicons } from '@expo/vector-icons';
import type { HabitDefinition } from '../../../../store/habitStore'
import { Colors } from '../../design-tokens';

interface HabitItemProps {
    habit: HabitDefinition
    onEdit: () => void
    onDelete: () => void
    onToggle: () => void
}

export const HabitItem = ({
    habit,
    onEdit,
    onDelete,
    onToggle,
}: HabitItemProps) => {
    return (
        <SettingsListItem color={habit.color}>
            {/* Content */}
            <TouchableOpacity onPress={onEdit} className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Ionicons name={habit.icon as any} size={20} color={habit.color} />
                    <Text className="text-white font-bold text-base">{habit.title}</Text>
                </View>
            </TouchableOpacity>

            {/* Actions */}
            <View className="flex-row items-center gap-3">
                <Switch
                    value={habit.isEnabled}
                    onValueChange={onToggle}
                    trackColor={{ false: Colors.surfaceHighlight, true: habit.color }}
                    thumbColor={habit.isEnabled ? Colors.white : Colors.text.tertiary}
                    className="scale-75"
                />
                <ActionButton
                    onPress={onDelete}
                    icon="trash-outline"
                    variant="danger"
                />
            </View>
        </SettingsListItem>
    )
}
