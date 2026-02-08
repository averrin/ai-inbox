import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useEventTypesStore } from '../../store/eventTypes'
import { TimeRangeItem } from '../ui/calendar/components/TimeRangeItem'
import { TimeRangeForm } from '../ui/calendar/components/TimeRangeForm'
import type { TimeRangeDefinition } from '../ui/calendar/interfaces'

export function TimeRangesSettings() {
    const { ranges, addRange, updateRange, deleteRange, toggleRange } = useEventTypesStore()
    const [editingRange, setEditingRange] = React.useState<TimeRangeDefinition | null>(
        null
    )
    const [isCreating, setIsCreating] = React.useState(false)

    const handleCreate = (values: Omit<TimeRangeDefinition, 'id' | 'isEnabled'>) => {
        addRange(values)
        setIsCreating(false)
    }

    const handleUpdate = (values: Omit<TimeRangeDefinition, 'id' | 'isEnabled'>) => {
        if (editingRange) {
            updateRange(editingRange.id, values)
            setEditingRange(null)
        }
    }

    const renderContent = () => {
        if (isCreating) {
            return (
                <TimeRangeForm
                    onSubmit={handleCreate}
                    onCancel={() => setIsCreating(false)}
                />
            )
        }

        if (editingRange) {
            return (
                <TimeRangeForm
                    initialValues={editingRange}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditingRange(null)}
                />
            )
        }

        return (
            <View>
                {ranges.length === 0 ? (
                    <View className="items-center py-8">
                        <Text className="text-slate-500 mb-2">No time ranges defined</Text>
                        <Text className="text-slate-600 text-xs text-center px-8">
                            Create a time range to visualize recurring blocks like working hours or gym
                            time on your calendar.
                        </Text>
                    </View>
                ) : (
                    ranges.map((range) => (
                        <TimeRangeItem
                            key={range.id}
                            range={range}
                            onEdit={() => setEditingRange(range)}
                            onDelete={() => deleteRange(range.id)}
                            onToggle={() => toggleRange(range.id)}
                        />
                    ))
                )}

                <TouchableOpacity
                    onPress={() => setIsCreating(true)}
                    className="bg-slate-800 border-2 border-dashed border-slate-700 rounded-lg p-4 items-center mt-4"
                >
                    <Text className="text-slate-400 font-bold">+ Add New Time Range</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <View className="flex-1 px-4">
            <Text className="text-slate-400 text-sm mb-4">
                Manage recurring time blocks that appear on your calendar.
            </Text>
            <ScrollView className="flex-1">
                {renderContent()}
            </ScrollView>
        </View>
    )
}
