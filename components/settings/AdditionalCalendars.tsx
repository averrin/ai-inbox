import React, { useEffect, useState } from 'react';
import { View, Text, Switch, FlatList, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import * as Calendar from 'expo-calendar';
import { useSettingsStore } from '../../store/settings';
import { useEventTypesStore } from '../../store/eventTypes';
import { getWritableCalendars } from '../../services/calendarService';
import { SettingsListItem } from '../ui/SettingsListItem';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { MetadataChip } from '../ui/MetadataChip';
import { Colors, Palette } from '../ui/design-tokens';

export function AdditionalCalendars() {
    const {
        visibleCalendarIds, setVisibleCalendarIds,
        personalCalendarIds, workCalendarIds,
        calendarDefaultEventTypes, setCalendarDefaultEventTypes,
        defaultCreateCalendarId, setDefaultCreateCalendarId,
        defaultOpenCalendarId, setDefaultOpenCalendarId
    } = useSettingsStore();
    const { eventTypes } = useEventTypesStore();

    const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
    const [loading, setLoading] = useState(true);
    const [showTypePicker, setShowTypePicker] = useState<string | null>(null);

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

    const handleSetDefaultType = (calendarId: string, typeId: string | null) => {
        const newTypes = { ...calendarDefaultEventTypes };
        if (typeId) {
            newTypes[calendarId] = typeId;
        } else {
            delete newTypes[calendarId];
        }
        setCalendarDefaultEventTypes(newTypes);
        setShowTypePicker(null);
    };

    const renderItem = ({ item: cal }: { item: Calendar.Calendar }) => {
        const isVisible = visibleCalendarIds.includes(cal.id);
        const isCreateDefault = defaultCreateCalendarId === cal.id;
        const isOpenDefault = defaultOpenCalendarId === cal.id;
        const defaultTypeId = calendarDefaultEventTypes[cal.id];
        const defaultType = eventTypes.find(t => t.id === defaultTypeId);

        return (
            <View className="mb-2">
                <SettingsListItem color={cal.color}>
                    <View className="flex-1 flex-row items-center">
                        <View className="flex-1">
                            <Text className="text-white font-medium" numberOfLines={1}>
                                {cal.title}
                            </Text>
                            <Text className="text-secondary text-xs">{cal.source.name}</Text>
                        </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <Switch
                            value={isVisible}
                            onValueChange={() => toggleCalendar(cal.id, isVisible)}
                            trackColor={{ false: Colors.surfaceHighlight, true: cal.color }}
                            thumbColor={isVisible ? Colors.white : Colors.text.tertiary}
                            className="scale-75"
                        />
                    </View>
                </SettingsListItem>

                {isVisible && (
                    <View className="ml-4 pl-4 border-l-2 border-border/50 mt-1">
                        {/* Default Logic */}
                        <View className="flex-row items-center gap-2 mb-2">
                            <MetadataChip
                                icon="add-circle"
                                label="Default Create"
                                variant={isCreateDefault ? 'solid' : 'outline'}
                                color={Colors.success}
                                onPress={() => setDefaultCreateCalendarId(cal.id)}
                            />

                            <MetadataChip
                                icon="eye"
                                label="Default Open"
                                variant={isOpenDefault ? 'solid' : 'outline'}
                                color={Colors.warning}
                                onPress={() => setDefaultOpenCalendarId(cal.id)}
                            />
                        </View>

                        {/* Default Event Type Picker Trigger */}
                        <TouchableOpacity
                            onPress={() => setShowTypePicker(cal.id)}
                            className="flex-row items-center justify-between bg-surface/50 px-3 py-2 rounded-lg border border-border"
                        >
                            <Text className="text-text-tertiary text-xs">Default Event Type:</Text>
                            <View className="flex-row items-center gap-1">
                                {defaultType ? (
                                    <View className="flex-row items-center gap-1 bg-surface-highlight px-1.5 py-0.5 rounded">
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: defaultType.color }} />
                                        <Text className="text-white text-xs">{defaultType.title}</Text>
                                    </View>
                                ) : (
                                    <Text className="text-secondary text-xs italic">None</Text>
                                )}
                                <Ionicons name="chevron-down" size={12} color={Colors.secondary} />
                            </View>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
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
                <Text className="text-text-secondary font-semibold mb-2">Additional Calendars</Text>
                <Text className="text-text-tertiary text-sm">
                    Toggle visibility for calendars not assigned to Personal or Work.
                </Text>
            </View>

            {filteredCalendars.length === 0 ? (
                <Text className="text-text-tertiary text-sm italic py-4">
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

            {/* Event Type Picker Modal */}
            <Modal visible={!!showTypePicker} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/70 p-4">
                    <View className="bg-background w-full max-w-sm rounded-2xl p-4 border border-border">
                        <Text className="text-white text-lg font-bold mb-4">Select Default Event Type</Text>

                        <TouchableOpacity
                            onPress={() => handleSetDefaultType(showTypePicker!, null)}
                            className="p-3 border-b border-border"
                        >
                            <Text className="text-text-tertiary italic">None (Auto-detect)</Text>
                        </TouchableOpacity>

                        <FlatList
                            data={eventTypes}
                            keyExtractor={item => item.id}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => handleSetDefaultType(showTypePicker!, item.id)}
                                    className="flex-row items-center gap-3 p-3 border-b border-border"
                                >
                                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color }} />
                                    <Text className="text-white font-medium">{item.title}</Text>
                                    {calendarDefaultEventTypes[showTypePicker!] === item.id && (
                                        <Ionicons name="checkmark" size={16} color="#818cf8" className="ml-auto" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />

                        <Button
                            title="Cancel"
                            onPress={() => setShowTypePicker(null)}
                            variant="secondary"
                            className="mt-4"
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
