import React from 'react'
import {
    View,
    Text,
    Modal,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native'
import { useEventTypesStore } from '../../../store/eventTypes'
import { TimeRangeItem } from './components/TimeRangeItem'
import { TimeRangeForm } from './components/TimeRangeForm'
import type { TimeRangeDefinition } from './interfaces'

interface TimeRangesModalProps {
    visible: boolean
    onClose: () => void
}

export const TimeRangesModal = ({ visible, onClose }: TimeRangesModalProps) => {
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
                        <Text className="text-secondary mb-2">No time ranges defined</Text>
                        <Text className="text-text-tertiary text-xs text-center px-8">
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
                    className="bg-surface border-2 border-dashed border-border rounded-lg p-4 items-center mt-4"
                >
                    <Text className="text-text-tertiary font-bold">+ Add New Time Range</Text>
                </TouchableOpacity>
            </View>
        )
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-slate-950">
                <SafeAreaView className="flex-1">
                    <View className="px-4 py-3 border-b border-border flex-row justify-between items-center">
                        <Text className="text-white font-bold text-lg">Time Ranges</Text>
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <Text className="text-primary font-bold text-base">Done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 px-4 py-4">
                        <Text className="text-text-tertiary text-sm mb-4">
                            Manage recurring time blocks that appear on your calendar.
                        </Text>
                        {renderContent()}
                    </ScrollView>
                </SafeAreaView>
            </View>
        </Modal>
    )
}
