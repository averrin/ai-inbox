import React from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { Ionicons } from '@expo/vector-icons';

interface Props {
    visible: boolean;
    onClose: () => void;
    eventTitle: string | null;
}

export function EventContextModal({ visible, onClose, eventTitle }: Props) {
    const { eventTypes, assignments, difficulties, assignTypeToTitle, unassignType, setDifficulty } = useEventTypesStore();

    if (!eventTitle) return null;

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
                        <View className="flex-row items-center justify-between bg-slate-800 p-3 rounded-xl">
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
