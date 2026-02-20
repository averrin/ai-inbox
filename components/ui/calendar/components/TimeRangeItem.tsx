import React from 'react'
import { View, Text, TouchableOpacity, Switch } from 'react-native'
import dayjs from 'dayjs'
import { ActionButton } from '../../ActionButton'
import { SettingsListItem } from '../../SettingsListItem'
import type { TimeRangeDefinition } from '../interfaces'
import { Colors } from '../../design-tokens';

interface TimeRangeItemProps {
    range: TimeRangeDefinition
    onEdit: () => void
    onDelete: () => void
    onToggle: () => void
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Monday first

export const TimeRangeItem = ({
    range,
    onEdit,
    onDelete,
    onToggle,
}: TimeRangeItemProps) => {
    const startTime = dayjs().hour(range.start.hour).minute(range.start.minute)
    const endTime = dayjs().hour(range.end.hour).minute(range.end.minute)

    return (
        <SettingsListItem color={range.color}>
            {/* Content */}
            <TouchableOpacity onPress={onEdit} className="flex-1">
                <View className="flex-row items-baseline gap-2 mb-1">
                    <Text className="text-white font-bold text-base">{range.title}</Text>
                    <Text className="text-text-tertiary text-xs">
                        {startTime.format('HH:mm')} - {endTime.format('HH:mm')}
                    </Text>
                </View>

                {/* Days indicators */}
                <View className="flex-row gap-1">
                    {DAYS.map((day, index) => {
                        // Map UI index to Dayjs index to check against store
                        // UI 0 (M) -> Dayjs 1
                        // UI 6 (S) -> Dayjs 0
                        const dayjsValue = (index + 1) % 7
                        const isActive = range.days.includes(dayjsValue)
                        return (
                            <View
                                key={index}
                                style={{
                                    backgroundColor: isActive ? range.color : Colors.surface,
                                    borderColor: isActive ? range.color : '#475569',
                                }}
                                className="px-2 py-0.5 rounded border"
                            >
                                <Text
                                    className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-secondary'}`}
                                >
                                    {day}
                                </Text>
                            </View>
                        )
                    })}
                </View>
            </TouchableOpacity>

            {/* Actions */}
            <View className="flex-row items-center gap-3">
                <Switch
                    value={range.isEnabled}
                    onValueChange={onToggle}
                    trackColor={{ false: Colors.surfaceHighlight, true: range.color }}
                    thumbColor={range.isEnabled ? Colors.white : Colors.text.tertiary}
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
