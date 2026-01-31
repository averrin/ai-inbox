import React from 'react'
import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native'
import dayjs from 'dayjs'
import DateTimePicker from '@react-native-community/datetimepicker'

interface TimeRangeFormProps {
    initialValues?: {
        title: string
        start: { hour: number; minute: number }
        end: { hour: number; minute: number }
        days: number[]
        color: string
        isWork?: boolean
    }
    onSubmit: (values: {
        title: string
        start: { hour: number; minute: number }
        end: { hour: number; minute: number }
        days: number[]
        color: string
        isWork?: boolean
    }) => void
    onCancel: () => void
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] // Monday first
const COLORS = [
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#3b82f6', // blue
    '#a855f7', // purple
    '#ec4899', // pink
    '#64748b', // slate
]

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
    const [days, setDays] = React.useState<number[]>(initialValues?.days || [1, 2, 3, 4, 5]) // Mon-Fri by default
    const [color, setColor] = React.useState(initialValues?.color || '#3b82f6')
    const [isWork, setIsWork] = React.useState(initialValues?.isWork || false)

    const [showStartPicker, setShowStartPicker] = React.useState(false)
    const [showEndPicker, setShowEndPicker] = React.useState(false)

    const toggleDay = (dayIndex: number) => {
        setDays((prev) =>
            prev.includes(dayIndex)
                ? prev.filter((d) => d !== dayIndex)
                : [...prev, dayIndex].sort()
        )
    }

    const handleSubmit = () => {
        if (!title.trim()) return

        onSubmit({
            title,
            start: { hour: dayjs(start).hour(), minute: dayjs(start).minute() },
            end: { hour: dayjs(end).hour(), minute: dayjs(end).minute() },
            days,
            color,
            isWork,
        })
    }

    return (
        <View className="bg-slate-900 p-4 rounded-lg space-y-4">
            {/* Title */}
            <View>
                <Text className="text-slate-400 text-xs uppercase font-bold mb-1">Title</Text>
                <TextInput
                    className="bg-slate-800 text-white p-3 rounded-md border border-slate-700 font-medium"
                    placeholder="Works Hours, Gym, etc."
                    placeholderTextColor="#64748b"
                    value={title}
                    onChangeText={setTitle}
                />
            </View>

            <View className="flex-row items-center justify-between py-2">
                <Text className="text-slate-400 text-xs uppercase font-bold">Is Work Range?</Text>
                <Switch
                    value={isWork}
                    onValueChange={setIsWork}
                    trackColor={{ false: '#334155', true: color }}
                    thumbColor="#fff"
                />
            </View>

            {/* Time */}
            <View className="flex-row gap-4">
                <View className="flex-1">
                    <Text className="text-slate-400 text-xs uppercase font-bold mb-1">Start Time</Text>
                    <TouchableOpacity
                        className="bg-slate-800 p-3 rounded-md border border-slate-700"
                        onPress={() => setShowStartPicker(true)}
                    >
                        <Text className="text-white text-center font-medium">
                            {dayjs(start).format('HH:mm')}
                        </Text>
                    </TouchableOpacity>
                </View>
                <View className="flex-1">
                    <Text className="text-slate-400 text-xs uppercase font-bold mb-1">End Time</Text>
                    <TouchableOpacity
                        className="bg-slate-800 p-3 rounded-md border border-slate-700"
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
                <Text className="text-slate-400 text-xs uppercase font-bold mb-1">Repeat Days</Text>
                <View className="flex-row justify-between gap-1">
                    {DAYS.map((dayLabel, index) => {
                        const isSelected = days.includes(index)
                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={() => toggleDay(index)}
                                style={{
                                    backgroundColor: isSelected ? color : '#1e293b',
                                    borderColor: isSelected ? color : '#475569',
                                }}
                                className={`flex-1 h-10 rounded-lg items-center justify-center border-2`}
                            >
                                <Text
                                    className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-500'
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
            <View>
                <Text className="text-slate-400 text-xs uppercase font-bold mb-1">Color</Text>
                <View className="flex-row flex-wrap gap-2">
                    {COLORS.map((c) => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setColor(c)}
                            className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'
                                }`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </View>
            </View>

            {/* Actions */}
            <View className="flex-row justify-end gap-3 mt-4">
                <TouchableOpacity onPress={onCancel} className="px-4 py-2">
                    <Text className="text-slate-400 font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSubmit}
                    className={`px-4 py-2 rounded-md ${title.trim() ? 'bg-blue-600' : 'bg-slate-700'
                        }`}
                    disabled={!title.trim()}
                >
                    <Text
                        className={`font-bold ${title.trim() ? 'text-white' : 'text-slate-500'
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
