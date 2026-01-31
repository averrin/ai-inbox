import React, { useEffect, useState } from 'react';
import { View, Text, Switch, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as Calendar from 'expo-calendar';
import { useSettingsStore } from '../store/settings';
import { getWritableCalendars } from '../services/calendarService';

export function CalendarSelector({ onClose }: { onClose?: () => void }) {
    const { visibleCalendarIds, setVisibleCalendarIds } = useSettingsStore();
    const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCalendars();
    }, []);

    const loadCalendars = async () => {
        try {
            const cals = await getWritableCalendars();
            setCalendars(cals);
        } catch (e) {
            console.error('Failed to load calendars', e);
        } finally {
            setLoading(false);
        }
    };

    const toggleCalendar = (id: string) => {
        if (visibleCalendarIds.includes(id)) {
            setVisibleCalendarIds(visibleCalendarIds.filter(c => c !== id));
        } else {
            setVisibleCalendarIds([...visibleCalendarIds, id]);
        }
    };

    const renderItem = ({ item: cal }: { item: Calendar.Calendar }) => (
        <View className="flex-row items-center justify-between p-4 border-b border-slate-700 bg-slate-800 first:rounded-t-xl last:rounded-b-xl">
             <View className="flex-row items-center flex-1 mr-4">
                <View 
                    style={{ backgroundColor: cal.color, width: 12, height: 12, borderRadius: 6 }} 
                    className="mr-3"
                />
                <View>
                    <Text className="text-white font-medium" numberOfLines={1}>{cal.title}</Text>
                    <Text className="text-slate-500 text-xs">{cal.source.name}</Text>
                </View>
            </View>
            <Switch
                value={visibleCalendarIds.includes(cal.id)}
                onValueChange={() => toggleCalendar(cal.id)}
                trackColor={{ false: "#334155", true: "#4f46e5" }}
                thumbColor={visibleCalendarIds.includes(cal.id) ? "#ffffff" : "#94a3b8"}
            />
        </View>
    );

    if (loading) {
        return <ActivityIndicator size="small" color="#818cf8" />;
    }

    if (calendars.length === 0) {
        return (
            <View>
                <Text className="text-slate-400 text-sm italic">
                    No calendars found or permission denied.
                </Text>
                {onClose && (
                    <TouchableOpacity onPress={onClose} className="mt-4 bg-slate-700 p-3 rounded-lg items-center">
                        <Text className="text-white font-medium">Close</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    return (
        <View className="flex-1">
             <Text className="text-indigo-200 font-medium mb-3">Visible Calendars</Text>
             <FlatList
                data={calendars}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={true}
                ListFooterComponent={
                    onClose ? (
                        <TouchableOpacity 
                            onPress={onClose}
                            className="mt-6 bg-indigo-600 p-4 rounded-xl items-center mb-6"
                        >
                            <Text className="text-white font-bold text-lg">Save & Close</Text>
                        </TouchableOpacity>
                    ) : null
                }
             />
        </View>
    );
}
