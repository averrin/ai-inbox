import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useEventTypesStore } from '../store/eventTypes';
import { getWritableCalendars } from '../services/calendarService';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'expo-calendar';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export function LunchSettings({ visible, onClose }: Props) {
    const { lunchConfig, updateLunchConfig } = useEventTypesStore();
    const [calendars, setCalendars] = useState<Calendar[]>([]);

    // Local state
    const [targetCalendarId, setTargetCalendarId] = useState<string | undefined>(lunchConfig?.targetCalendarId);
    const [defaultInvitee, setDefaultInvitee] = useState<string | undefined>(lunchConfig?.defaultInvitee);

    useEffect(() => {
        if (visible) {
            setTargetCalendarId(lunchConfig?.targetCalendarId);
            setDefaultInvitee(lunchConfig?.defaultInvitee);

            getWritableCalendars().then(cals => {
                setCalendars(cals.filter(c => c.allowsModifications));
            });
        }
    }, [visible, lunchConfig]);

    const handleSave = async () => {
        await updateLunchConfig({
            targetCalendarId,
            defaultInvitee
        });
        onClose();
    };

    if (!visible) return null;

    return (
        <View className="absolute inset-0 bg-black/80 z-50 justify-center items-center p-4">
            <View className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-700 max-h-[80%] flex">
                <View className="p-4 border-b border-slate-800 flex-row justify-between items-center">
                    <Text className="text-white text-lg font-bold">Lunch Settings</Text>
                    <TouchableOpacity onPress={onClose} className="p-1">
                        <Ionicons name="close" size={24} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                <ScrollView className="p-4">
                    {/* Target Calendar Selection */}
                    <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Target Calendar</Text>
                    <View className="bg-slate-800 rounded-xl overflow-hidden mb-6">
                        {calendars.length === 0 ? (
                            <Text className="text-slate-500 p-4 italic">No writable calendars found</Text>
                        ) : (
                            calendars.map((cal, index) => {
                                const isSelected = targetCalendarId === cal.id;
                                return (
                                    <TouchableOpacity
                                        key={cal.id}
                                        onPress={() => setTargetCalendarId(cal.id)}
                                        className={`flex-row items-center p-3 border-b border-slate-700/50 ${isSelected ? 'bg-indigo-500/10' : ''}`}
                                    >
                                        <View
                                            className="w-3 h-3 rounded-full mr-3"
                                            style={{ backgroundColor: cal.color }}
                                        />
                                        <Text className={`flex-1 ${isSelected ? 'text-indigo-400 font-bold' : 'text-slate-300'}`}>
                                            {cal.title}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={20} color="#818cf8" />
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {/* Default Invitee */}
                    <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Default Invitee (Optional)</Text>
                    <View className="bg-slate-800 rounded-xl border border-slate-700 mb-2">
                        <TextInput
                            className="p-3 text-white"
                            placeholder="email@example.com"
                            placeholderTextColor="#64748b"
                            value={defaultInvitee}
                            onChangeText={setDefaultInvitee}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>
                    <Text className="text-slate-500 text-xs mb-6">
                        Automatically invite this person when materializing lunch.
                    </Text>

                </ScrollView>

                <View className="p-4 border-t border-slate-800">
                    <TouchableOpacity
                        onPress={handleSave}
                        className="bg-indigo-600 p-3 rounded-xl items-center"
                    >
                        <Text className="text-white font-bold">Save Settings</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
