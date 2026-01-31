import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';

interface Props {
    visible: boolean;
    onClose: () => void;
    event: {
        title: string;
        start: Date;
        end: Date;
    } | null;
}

export function EventContextModal({ visible, onClose, event }: Props) {
    const { eventTypes, assignments, difficulties, ranges, assignTypeToTitle, unassignType, setDifficulty } = useEventTypesStore();

    const { bonusDifficulty, reasons } = useMemo(() => {
        if (!event || !visible) return { bonusDifficulty: 0, reasons: [] };

        const reasons: string[] = [];
        let bonus = 0;

        const evtStart = dayjs(event.start);
        const evtEnd = dayjs(event.end);

        // 1. Check for intersection with Non-Work ranges (isWork = false)
        const nonWorkRanges = ranges.filter(r => r.isEnabled && !r.isWork);

        let current = evtStart.startOf('day');
        const endDay = evtEnd.endOf('day');

        while (current.isBefore(endDay) || current.isSame(endDay)) {
            const dayOfWeek = current.day();

            nonWorkRanges.forEach(range => {
                if (range.days.includes(dayOfWeek)) {
                    // Construct range start/end for this day
                    const rStart = current.hour(range.start.hour).minute(range.start.minute).second(0);
                    let rEnd = current.hour(range.end.hour).minute(range.end.minute).second(0);

                    // Handle midnight span
                    if (rEnd.isBefore(rStart)) {
                        rEnd = rEnd.add(1, 'day');
                    }

                    // Check overlap: start < rEnd && end > rStart
                    if (evtStart.isBefore(rEnd) && evtEnd.isAfter(rStart)) {
                        const reason = `Intersects ${range.title}`;
                        if (!reasons.includes(reason)) {
                            reasons.push(reason);
                            bonus += 1;
                        }
                    }
                }
            });

            current = current.add(1, 'day');
        }

        // 2. Check for intersection with "Outside Work Hours"
        const workRanges = ranges.filter(r => r.isEnabled && r.isWork);
        if (workRanges.length > 0) {
            const relevantWorkIntervals: { start: dayjs.Dayjs, end: dayjs.Dayjs }[] = [];

            let curr = evtStart.startOf('day');
            while (curr.isBefore(endDay) || curr.isSame(endDay)) {
                const d = curr.day();
                workRanges.forEach(range => {
                    if (range.days.includes(d)) {
                        const rStart = curr.hour(range.start.hour).minute(range.start.minute).second(0);
                        let rEnd = curr.hour(range.end.hour).minute(range.end.minute).second(0);
                        if (rEnd.isBefore(rStart)) rEnd = rEnd.add(1, 'day');

                        // Intersection with event
                        const intStart = rStart.isAfter(evtStart) ? rStart : evtStart;
                        const intEnd = rEnd.isBefore(evtEnd) ? rEnd : evtEnd;

                        if (intStart.isBefore(intEnd)) {
                            relevantWorkIntervals.push({ start: intStart, end: intEnd });
                        }
                    }
                });
                curr = curr.add(1, 'day');
            }

            relevantWorkIntervals.sort((a, b) => a.start.valueOf() - b.start.valueOf());

            const merged: { start: dayjs.Dayjs, end: dayjs.Dayjs }[] = [];
            if (relevantWorkIntervals.length > 0) {
                let currentInt = relevantWorkIntervals[0];
                for (let i = 1; i < relevantWorkIntervals.length; i++) {
                    if (relevantWorkIntervals[i].start.isBefore(currentInt.end) || relevantWorkIntervals[i].start.isSame(currentInt.end)) {
                        if (relevantWorkIntervals[i].end.isAfter(currentInt.end)) {
                            currentInt.end = relevantWorkIntervals[i].end;
                        }
                    } else {
                        merged.push(currentInt);
                        currentInt = relevantWorkIntervals[i];
                    }
                }
                merged.push(currentInt);
            }

            let coveredDuration = 0;
            merged.forEach(m => {
                coveredDuration += m.end.diff(m.start);
            });

            const eventDuration = evtEnd.diff(evtStart);

            if (coveredDuration < eventDuration) {
                const reason = "Outside Work Hours";
                if (!reasons.includes(reason)) {
                    reasons.push(reason);
                    bonus += 1;
                }
            }
        }

        return { bonusDifficulty: bonus, reasons };
    }, [event, visible, ranges]);

    if (!event) return null;
    const eventTitle = event.title;

    // Current assignment
    const currentTypeId = assignments[eventTitle];
    const difficulty = difficulties?.[eventTitle] || 0;
    const currentType = eventTypes.find(t => t.id === currentTypeId);

    const handleAssign = async (typeId: string) => {
        await assignTypeToTitle(eventTitle, typeId);
        onClose();
    };

    const handleUnassign = async () => {
        await unassignType(eventTitle);
        onClose();
    };

    const totalDifficulty = difficulty + bonusDifficulty;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    className="bg-slate-900 rounded-xl overflow-hidden max-h-[70%]"
                    onStartShouldSetResponder={() => true} // Catch taps
                >
                    <View className="p-4 border-b border-slate-800">
                        <Text className="text-white text-lg font-bold">Assign Properties</Text>
                        <Text className="text-slate-400 text-sm mt-1 mb-4" numberOfLines={1}>
                            "{eventTitle}"
                        </Text>

                        {/* Difficulty Selector */}
                        <View className="bg-slate-800 p-3 rounded-xl gap-2">
                            <View className="flex-row items-center justify-between">
                                <Text className="text-slate-300 font-medium">Difficulty</Text>
                                <View className="flex-row gap-1">
                                    {[0, 1, 2, 3, 4, 5].map((level) => (
                                        <TouchableOpacity
                                            key={level}
                                            onPress={() => setDifficulty(eventTitle, level === difficulty ? 0 : level)}
                                            className={`w-8 h-8 rounded-full items-center justify-center ${level <= difficulty ? 'bg-indigo-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <Text className={`font-bold ${level <= difficulty ? 'text-white' : 'text-slate-400'}`}>
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {bonusDifficulty > 0 && (
                                <View className="border-t border-slate-700 pt-2 mt-1">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-slate-400 text-xs">Base: {difficulty}</Text>
                                        <Text className="text-amber-500 text-xs font-bold">+ {bonusDifficulty} Bonus</Text>
                                        <Text className="text-white text-xs font-bold">Total: {totalDifficulty}</Text>
                                    </View>
                                    <View className="mt-1">
                                        {reasons.map((reason, idx) => (
                                            <Text key={idx} className="text-amber-500/80 text-[10px] italic">
                                                • {reason}
                                            </Text>
                                        ))}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    <FlatList
                        data={eventTypes}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleAssign(item.id)}
                                className="flex-row items-center justify-between p-4 border-b border-slate-800 active:bg-slate-800"
                            >
                                <View className="flex-row items-center gap-3">
                                    <View
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <Text className={`text-base font-medium ${item.id === currentTypeId ? 'text-white' : 'text-slate-300'}`}>
                                        {item.title}
                                    </Text>
                                </View>
                                {item.id === currentTypeId && (
                                    <Ionicons name="checkmark" size={20} color="#818cf8" />
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            <View className="p-6 items-center">
                                <Text className="text-slate-500 text-center">No types defined yet.</Text>
                                <Text className="text-slate-600 text-xs text-center mt-2">Go to Schedule Settings to create types.</Text>
                            </View>
                        }
                    />

                    {currentType && (
                        <TouchableOpacity
                            onPress={handleUnassign}
                            className="p-4 flex-row items-center justify-center gap-2 border-t border-slate-800 bg-slate-800/50"
                        >
                            <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                            <Text className="text-red-500 font-medium">Remove Assignment</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
