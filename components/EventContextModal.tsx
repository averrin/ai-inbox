import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { calculateEventDifficulty } from '../utils/difficultyUtils';

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
    const {
        eventTypes,
        assignments,
        difficulties,
        ranges,
        eventFlags,
        assignTypeToTitle,
        unassignType,
        setDifficulty,
        toggleEventFlag
    } = useEventTypesStore();

    // Calculate derived difficulty
    const currentDifficulty = difficulties?.[event?.title || ''] || 0;

    const { bonus: bonusDifficulty, total: totalDifficulty, reasons } = useMemo(() => {
        if (!event || !visible) return { bonus: 0, total: currentDifficulty, reasons: [] };

        return calculateEventDifficulty(
            event,
            currentDifficulty,
            ranges,
            eventFlags?.[event.title]
        );
    }, [event, visible, ranges, eventFlags, currentDifficulty]);

    if (!event) return null;
    const eventTitle = event.title;

    // Current assignment
    const currentTypeId = assignments[eventTitle];
    const difficulty = currentDifficulty;
    const currentType = eventTypes.find(t => t.id === currentTypeId);
    const flags = eventFlags?.[eventTitle];

    const handleAssign = async (typeId: string) => {
        await assignTypeToTitle(eventTitle, typeId);
        onClose();
    };

    const handleUnassign = async () => {
        await unassignType(eventTitle);
        onClose();
    };

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

                            <View className="flex-row items-center justify-between border-t border-slate-700 pt-2 mt-1">
                                {/* Flags */}
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'isEnglish')}
                                        className={`px-2 py-1 rounded-md border ${flags?.isEnglish ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <Text className={`text-xs ${flags?.isEnglish ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>
                                            English
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'movable')}
                                        className={`px-2 py-1 rounded-md border ${flags?.movable ? 'bg-emerald-500/20 border-emerald-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="move" size={12} color={flags?.movable ? '#34d399' : '#94a3b8'} />
                                            <Text className={`text-xs ${flags?.movable ? 'text-emerald-400 font-bold' : 'text-slate-400'}`}>
                                                Movable
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
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
