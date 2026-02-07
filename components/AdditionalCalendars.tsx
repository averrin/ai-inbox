import React, { useEffect, useState } from 'react';
import { View, Text, Switch, FlatList, ActivityIndicator } from 'react-native';
import * as Calendar from 'expo-calendar';
import { useSettingsStore } from '../store/settings';
import { getWritableCalendars } from '../services/calendarService';
import { SettingsListItem } from './ui/SettingsListItem';

export function AdditionalCalendars() {
    const {
        visibleCalendarIds, setVisibleCalendarIds,
        personalCalendarIds, workCalendarIds
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

    const toggleCalendar = async (id: string, currentVisible: boolean) => {
        let newIds;
        if (visibleCalendarIds.includes(id)) {
            newIds = visibleCalendarIds.filter(c => c !== id);
        } else {
            newIds = [...visibleCalendarIds, id];
        }
        setVisibleCalendarIds(newIds);

        // Also update native visibility to ensure getEventsAsync works
        try {
            await Calendar.updateCalendarAsync(id, { isVisible: !currentVisible });
        } catch (e) {
            console.error('[AdditionalCalendars] Failed to update native visibility', e);
        }
    };

    const renderItem = ({ item: cal }: { item: Calendar.Calendar }) => {
        return (
            <SettingsListItem color={cal.color}>
                <View className="flex-1 flex-row items-center">
                    <View>
                        <Text className="text-white font-medium" numberOfLines={1}>
                            {cal.title}
                        </Text>
                        <Text className="text-slate-500 text-xs">{cal.source.name}</Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <Switch
                        value={visibleCalendarIds.includes(cal.id)}
                        onValueChange={() => toggleCalendar(cal.id, visibleCalendarIds.includes(cal.id))}
                        trackColor={{ false: "#334155", true: cal.color }}
                        thumbColor={visibleCalendarIds.includes(cal.id) ? "#ffffff" : "#94a3b8"}
                        className="scale-75"
                    />
                </View>
            </SettingsListItem>
        );
    };

    // Filter out calendars that are already categorized as Personal or Work
    const filteredCalendars = calendars.filter(c =>
        !personalCalendarIds.includes(c.id) && !workCalendarIds.includes(c.id)
    );

    if (loading) {
        return <ActivityIndicator size="small" color="#818cf8" />;
    }

    return (
        <View className="flex-1">
            <View className="mb-4">
                <Text className="text-indigo-200 font-semibold mb-2">Additional Calendars</Text>
                <Text className="text-slate-400 text-sm">
                    Toggle visibility for calendars not assigned to Personal or Work.
                </Text>
            </View>

            {filteredCalendars.length === 0 ? (
                <Text className="text-slate-400 text-sm italic py-4">
                    No additional calendars found.
                </Text>
            ) : (
                <FlatList
                    data={filteredCalendars}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}
