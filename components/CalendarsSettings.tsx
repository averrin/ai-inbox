import React, { useEffect, useState } from 'react';
import { View, Text, Switch, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import * as Calendar from 'expo-calendar';
import { useSettingsStore } from '../store/settings';
import { getWritableCalendars } from '../services/calendarService';
import { Ionicons } from '@expo/vector-icons';
import { SettingsListItem } from './ui/SettingsListItem';

export function CalendarsSettings() {
    const {
        visibleCalendarIds, setVisibleCalendarIds,
        defaultCreateCalendarId, setDefaultCreateCalendarId,
        defaultOpenCalendarId, setDefaultOpenCalendarId,
        hideDeclinedEvents, setHideDeclinedEvents
    } = useSettingsStore();
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
        let newIds;
        if (visibleCalendarIds.includes(id)) {
            newIds = visibleCalendarIds.filter(c => c !== id);
        } else {
            newIds = [...visibleCalendarIds, id];
        }
        setVisibleCalendarIds(newIds);
    };

    const renderItem = ({ item: cal }: { item: Calendar.Calendar }) => {
        const isCreateDefault = defaultCreateCalendarId === cal.id;
        const isOpenDefault = defaultOpenCalendarId === cal.id;

        return (
            <SettingsListItem color={cal.color}>
                <View className="flex-1 flex-row items-center">
                    <View>
                        <Text className="text-white font-medium" numberOfLines={1}>
                            {cal.title}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                            <Text className="text-slate-500 text-xs">{cal.source.name}</Text>
                            {isCreateDefault && (
                                <View className="bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                    <Text className="text-emerald-500 text-[10px] font-bold">CREATE</Text>
                                </View>
                            )}
                            {isOpenDefault && (
                                <View className="bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                                    <Text className="text-amber-500 text-[10px] font-bold">OPEN</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    {/* Default for Create */}
                    <TouchableOpacity
                        onPress={() => setDefaultCreateCalendarId(cal.id)}
                        className={`p-2 rounded-lg ${isCreateDefault ? 'bg-emerald-500/10' : ''}`}
                    >
                        <Ionicons
                            name={isCreateDefault ? "add-circle" : "add-circle-outline"}
                            size={20}
                            color={isCreateDefault ? "#10b981" : "#64748b"}
                        />
                    </TouchableOpacity>

                    {/* Default for Open */}
                    <TouchableOpacity
                        onPress={() => setDefaultOpenCalendarId(cal.id)}
                        className={`p-2 rounded-lg ${isOpenDefault ? 'bg-amber-500/10' : ''}`}
                    >
                        <Ionicons
                            name={isOpenDefault ? "eye" : "eye-outline"}
                            size={20}
                            color={isOpenDefault ? "#f59e0b" : "#64748b"}
                        />
                    </TouchableOpacity>

                    <Switch
                        value={visibleCalendarIds.includes(cal.id)}
                        onValueChange={() => toggleCalendar(cal.id)}
                        trackColor={{ false: "#334155", true: cal.color }}
                        thumbColor={visibleCalendarIds.includes(cal.id) ? "#ffffff" : "#94a3b8"}
                        className="scale-75"
                    />
                </View>
            </SettingsListItem>
        );
    };

    if (loading) {
        return <ActivityIndicator size="small" color="#818cf8" />;
    }

    return (
        <View className="flex-1 px-4">
            <View className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 mb-6">
                <Text className="text-white font-semibold mb-4">Calendar Display</Text>
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-1 mr-4">
                        <Text className="text-white font-medium">Hide Declined Events</Text>
                        <Text className="text-slate-400 text-xs">Don't show events where you've RSVP'd "No"</Text>
                    </View>
                    <Switch
                        value={hideDeclinedEvents}
                        onValueChange={setHideDeclinedEvents}
                        trackColor={{ false: "#334155", true: "#818cf8" }}
                        thumbColor={hideDeclinedEvents ? "#ffffff" : "#94a3b8"}
                    />
                </View>

                <View className="h-[1px] bg-slate-700/50 mb-4" />

                <Text className="text-slate-400 text-[10px] font-bold uppercase mb-3 tracking-wider">Default Actions</Text>
                <View className="flex-row items-center gap-3 mb-2">
                    <Ionicons name="add-circle" size={16} color="#10b981" />
                    <Text className="text-slate-400 text-xs flex-1">
                        <Text className="text-emerald-500 font-bold">Create Default:</Text> Where new events are added unless changed.
                    </Text>
                </View>
                <View className="flex-row items-center gap-3">
                    <Ionicons name="eye" size={16} color="#f59e0b" />
                    <Text className="text-slate-400 text-xs flex-1">
                        <Text className="text-amber-500 font-bold">Open Priority:</Text> Preferred calendar version to open for merged events.
                    </Text>
                </View>
            </View>

            {calendars.length === 0 ? (
                <Text className="text-slate-400 text-sm italic py-4">
                    No calendars found or permission denied.
                </Text>
            ) : (
                <FlatList
                    data={calendars}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false}
                />
            )}
        </View>
    );
}
