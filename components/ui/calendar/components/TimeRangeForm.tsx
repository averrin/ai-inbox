import React from 'react'
import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native'
import dayjs from 'dayjs'
import DateTimePicker from '@react-native-community/datetimepicker'
import { ColorPicker } from '../../ColorPicker'
import { Colors } from '../../design-tokens';

interface TimeRangeFormProps {
    initialValues?: {
        title: string
        start: { hour: number; minute: number }
        end: { hour: number; minute: number }
        days: number[]
        color: string
        isWork?: boolean
        isVisible?: boolean
    }
    onSubmit: (values: {
        title: string
        start: { hour: number; minute: number }
        end: { hour: number; minute: number }
        days: number[]
        color: string
        isWork?: boolean
        isVisible?: boolean
    }) => void
    onCancel: () => void
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Monday first

export const TimeRangeForm = ({
    initialValues,
    onSubmit,
    onCancel,
}: TimeRangeFormProps) => {
    const [title, setTitle] = React.useState(initialValues?.title || '')
    const [start, setStart] = React.useState(
        initialValues
            ? dayjs().hour(initialValues.start.hour).minute(initialValues.start.minute).toDate()
            : dayjs().hour(9).minute(0).toDate()
    )
    const [end, setEnd] = React.useState(
        initialValues
            ? dayjs().hour(initialValues.end.hour).minute(initialValues.end.minute).toDate()
            : dayjs().hour(17).minute(0).toDate()
    )
    // Convert initial Dayjs values to UI indices for state
    const [days, setDays] = React.useState<number[]>(
        initialValues?.days.map(d => (d + 6) % 7) || [0, 1, 2, 3, 4] // Mon-Fri by UI index
    )
    const [color, setColor] = React.useState(initialValues?.color || Colors.primary)
    const [isWork, setIsWork] = React.useState(initialValues?.isWork || false)
    const [isVisible, setIsVisible] = React.useState(initialValues?.isVisible ?? true)

    const [showStartPicker, setShowStartPicker] = React.useState(false)
    const [showEndPicker, setShowEndPicker] = React.useState(false)

    const toggleDay = (uiIndex: number) => {
        setDays((prev) =>
            prev.includes(uiIndex)
                ? prev.filter((d) => d !== uiIndex)
                : [...prev, uiIndex].sort()
        )
    }

    const handleSubmit = () => {
        if (!title.trim()) return

        // Convert UI indices back to Dayjs values for storage
        const dayjsDays = days.map(idx => (idx + 1) % 7).sort()

        onSubmit({
            title,
            start: { hour: dayjs(start).hour(), minute: dayjs(start).minute() },
            end: { hour: dayjs(end).hour(), minute: dayjs(end).minute() },
            days: dayjsDays,
            color,
            isWork,
            isVisible,
        })
    }

    return (
        <View className="bg-background p-4 rounded-lg space-y-4">
            {/* Title */}
            <View>
                <Text className="text-text-tertiary text-xs uppercase font-bold mb-1">Title</Text>
                <TextInput
                    className="bg-surface text-white p-3 rounded-md border border-border font-medium"
                    placeholder="Works Hours, Gym, etc."
                    placeholderTextColor={Colors.secondary}
                    value={title}
                    onChangeText={setTitle}
                />
            </View>

            <View className="flex-row items-center justify-between py-2">
                <Text className="text-text-tertiary text-xs uppercase font-bold">Is Work Range?</Text>
                <Switch
                    value={isWork}
                    onValueChange={setIsWork}
                    trackColor={{ false: Colors.surfaceHighlight, true: color }}
                    thumbColor="#fff"
                />
            </View>

            <View className="flex-row items-center justify-between py-2">
                <View>
                    <Text className="text-text-tertiary text-xs uppercase font-bold">Show on Calendar</Text>
                    <Text className="text-text-tertiary text-[10px]">If off, range stays invisible but affects suggestions.</Text>
                </View>
                <Switch
                    value={isVisible}
                    onValueChange={setIsVisible}
                    trackColor={{ false: Colors.surfaceHighlight, true: color }}
                    thumbColor="#fff"
                />
            </View>

            {/* Time */}
            <View className="flex-row gap-4">
                <View className="flex-1">
                    <Text className="text-text-tertiary text-xs uppercase font-bold mb-1">Start Time</Text>
                    <TouchableOpacity
                        className="bg-surface p-3 rounded-md border border-border"
                        onPress={() => setShowStartPicker(true)}
                    >
                        <Text className="text-white text-center font-medium">
                            {dayjs(start).format('HH:mm')}
                        </Text>
                    </TouchableOpacity>
                </View>
                <View className="flex-1">
                    <Text className="text-text-tertiary text-xs uppercase font-bold mb-1">End Time</Text>
                    <TouchableOpacity
                        className="bg-surface p-3 rounded-md border border-border"
                        onPress={() => setShowEndPicker(true)}
                    >
                        <Text className="text-white text-center font-medium">
                            {dayjs(end).format('HH:mm')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Day Selector */}
            <View>
                <Text className="text-text-tertiary text-xs uppercase font-bold mb-1">Repeat Days</Text>
                <View className="flex-row justify-between gap-1">
                    {DAYS.map((dayLabel, index) => {
                        const isSelected = days.includes(index)
                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => toggleDay(index)}
                                style={{
                                    backgroundColor: isSelected ? color : Colors.surface,
                                    borderColor: isSelected ? color : '#475569',
                                }}
                                className={`flex-1 h-10 rounded-lg items-center justify-center border-2`}
                            >
                                <Text
                                    className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-secondary'
                                        }`}
                                >
                                    {dayLabel}
                                </Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>
            </View>

            {/* Color Picker */}
            <ColorPicker
                value={color}
                onChange={setColor}
                label="Color"
            />

            {/* Actions */}
            <View className="flex-row justify-end gap-3 mt-4">
                <TouchableOpacity onPress={onCancel} className="px-4 py-2">
                    <Text className="text-text-tertiary font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSubmit}
                    className={`px-4 py-2 rounded-md ${title.trim() ? 'bg-primary' : 'bg-surface-highlight'
                        }`}
                    disabled={!title.trim()}
                >
                    <Text
                        className={`font-bold ${title.trim() ? 'text-white' : 'text-secondary'
                            }`}
                    >
                        Save Range
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Date Pickers (Modals) */}
            {showStartPicker && (
                <DateTimePicker
                    value={start}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowStartPicker(false)
                        if (selectedDate) setStart(selectedDate)
                    }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={end}
                    mode="time"
                    is24Hour={true}
                    display="default"
                    onChange={(event, selectedDate) => {
                        setShowEndPicker(false)
                        if (selectedDate) setEnd(selectedDate)
                    }}
                />
            )}
        </View>
    )
}
