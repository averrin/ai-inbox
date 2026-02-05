import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, Linking, Platform } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { updateEventRSVP } from '../services/calendarService';
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
        originalEvent?: any;
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
    console.log(event?.originalEvent?.source?.name);

    const attendees = event?.originalEvent?.attendees;
    const currentUserAttendee = useMemo(() => {
        if (!attendees || !Array.isArray(attendees)) return null;
        return attendees.find((a: any) => a.isCurrentUser);
    }, [attendees]);

    const handleAssign = async (typeId: string) => {
        await assignTypeToTitle(eventTitle, typeId);
        onClose();
    };

    const handleUnassign = async () => {
        await unassignType(eventTitle);
        onClose();
    };

    const handleRSVP = async (status: string) => {
        if (!event?.originalEvent?.id || !attendees) return;
        try {
            await updateEventRSVP(event.originalEvent.id, status, attendees);
            onClose();
        } catch (e) {
            console.error("RSVP failed", e);
            alert("Failed to update RSVP");
        }
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

                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'skippable')}
                                        className={`px-2 py-1 rounded-md border ${flags?.skippable ? 'bg-rose-500/20 border-rose-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="return-up-forward" size={12} color={flags?.skippable ? '#fb7185' : '#94a3b8'} />
                                            <Text className={`text-xs ${flags?.skippable ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                                                Skippable
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => toggleEventFlag(eventTitle, 'needPrep')}
                                        className={`px-2 py-1 rounded-md border ${flags?.needPrep ? 'bg-amber-500/20 border-amber-500' : 'bg-slate-700 border-transparent'}`}
                                    >
                                        <View className="flex-row items-center gap-1">
                                            <Ionicons name="pricetag-outline" size={12} color={flags?.needPrep ? '#fbbf24' : '#94a3b8'} />
                                            <Text className={`text-xs ${flags?.needPrep ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                                                Prep
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

                    {/* RSVP Section */}
                    {currentUserAttendee && (
                        <View className="p-4 border-t border-slate-800">
                            <Text className="text-slate-400 text-xs font-semibold uppercase mb-2">RSVP</Text>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => handleRSVP('accepted')}
                                    className={`flex-1 py-2 rounded-lg items-center justify-center ${currentUserAttendee.status === 'accepted' ? 'bg-emerald-500/20 border border-emerald-500' : 'bg-slate-800'}`}
                                >
                                    <Text className={`text-sm font-semibold ${currentUserAttendee.status === 'accepted' ? 'text-emerald-400' : 'text-slate-300'}`}>Yes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleRSVP('tentative')}
                                    className={`flex-1 py-2 rounded-lg items-center justify-center ${currentUserAttendee.status === 'tentative' ? 'bg-amber-500/20 border border-amber-500' : 'bg-slate-800'}`}
                                >
                                    <Text className={`text-sm font-semibold ${currentUserAttendee.status === 'tentative' ? 'text-amber-400' : 'text-slate-300'}`}>Maybe</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleRSVP('declined')}
                                    className={`flex-1 py-2 rounded-lg items-center justify-center ${currentUserAttendee.status === 'declined' ? 'bg-rose-500/20 border border-rose-500' : 'bg-slate-800'}`}
                                >
                                    <Text className={`text-sm font-semibold ${currentUserAttendee.status === 'declined' ? 'text-rose-400' : 'text-slate-300'}`}>No</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Source Calendars */}
                    {event?.originalEvent?.sourceCalendars && (
                        <View className="p-4 border-t border-slate-800">
                            <Text className="text-slate-400 text-xs font-semibold uppercase mb-2">Calendars</Text>
                            <View className="gap-2">
                                {(event.originalEvent.sourceCalendars as any[]).map((cal: any) => (
                                    <View key={cal.id} className="flex-row items-center gap-2">
                                        <View
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: cal.color || '#64748b' }}
                                        />
                                        <Text className="text-slate-300 text-sm">{cal.title}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Google Calendar Link */}
                    {/* {event?.originalEvent?.source?.name?.includes('Google') && ( */}
                    <TouchableOpacity
                        onPress={() => {
                            const dateMs = new Date(event.start).getTime();
                            const eventId = event.originalEvent?.id;

                            if (Platform.OS === 'android') {
                                if (eventId) {
                                    // Try to open specific event
                                    Linking.openURL(`content://com.android.calendar/events/${eventId}`);
                                } else {
                                    Linking.openURL(`content://com.android.calendar/time/${dateMs}`);
                                }
                            } else {
                                if (eventId && /^\d+$/.test(eventId)) {
                                    // On iOS, calshow:id works for some numeric IDs
                                    Linking.openURL(`calshow:${eventId}`);
                                } else {
                                    const dateSec = Math.floor(dateMs / 1000);
                                    Linking.openURL(`calshow:${dateSec}`);
                                }
                            }
                            onClose();
                        }}
                        className="p-4 flex-row items-center justify-center gap-2 border-t border-slate-800 bg-slate-800/30"
                    >
                        <Ionicons name="open-outline" size={20} color="#60a5fa" />
                        <Text className="text-blue-400 font-medium">Open in Calendar</Text>
                    </TouchableOpacity>
                    {/* )} */}

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
