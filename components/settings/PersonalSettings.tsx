import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Switch, FlatList, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import * as Calendar from 'expo-calendar';
import { useSettingsStore } from '../../store/settings';
import { useEventTypesStore } from '../../store/eventTypes';
import { getWritableCalendars } from '../../services/calendarService';
import { Ionicons } from '@expo/vector-icons';
import { SettingsListItem } from '../ui/SettingsListItem';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Colors, Palette } from '../ui/design-tokens';

export function PersonalSettings() {
    const {
        personalCalendarIds, setPersonalCalendarIds,
        personalAccountId, setPersonalAccountId,
        calendarDefaultEventTypes, setCalendarDefaultEventTypes,
        defaultCreateCalendarId, setDefaultCreateCalendarId,
        defaultOpenCalendarId, setDefaultOpenCalendarId,
        visibleCalendarIds, setVisibleCalendarIds
    } = useSettingsStore();

    const { eventTypes } = useEventTypesStore();

    const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
    const [loading, setLoading] = useState(true);
    const [showTypePicker, setShowTypePicker] = useState<string | null>(null); // Calendar ID to pick type for

    useEffect(() => {
        loadCalendars();
    }, []);

    // Auto-repair: If personalAccountId is missing but we have selected personal calendars, try to find an email
    useEffect(() => {
        if (!loading && calendars.length > 0 && personalCalendarIds.length > 0 && !personalAccountId) {
            const personalCal = calendars.find(c => personalCalendarIds.includes(c.id));
            if (personalCal && personalCal.source && personalCal.source.name && personalCal.source.name.includes('@')) {
                console.log('[PersonalSettings] Auto-repairing personalAccountId:', personalCal.source.name);
                setPersonalAccountId(personalCal.source.name);
            }
        }
    }, [loading, calendars, personalCalendarIds, personalAccountId]);

    const loadCalendars = async () => {
        try {
            const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
            setCalendars(cals.sort((a, b) => a.title.localeCompare(b.title)));
        } catch (e) {
            console.error('Failed to load calendars', e);
        } finally {
            setLoading(false);
        }
    };

    const togglePersonalCalendar = (id: string, sourceName?: string) => {
        let newIds;
        if (personalCalendarIds.includes(id)) {
            newIds = personalCalendarIds.filter(c => c !== id);
        } else {
            newIds = [...personalCalendarIds, id];
            // Also ensure it is visible?
            if (!visibleCalendarIds.includes(id)) {
                setVisibleCalendarIds([...visibleCalendarIds, id]);
            }
            // Auto-fill personal account ID if empty and source looks like an email
            if (!personalAccountId && sourceName && sourceName.includes('@')) {
                setPersonalAccountId(sourceName);
            }
        }
        setPersonalCalendarIds(newIds);
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
        const isPersonal = personalCalendarIds.includes(cal.id);
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
                    <Switch
                        value={isPersonal}
                        onValueChange={() => togglePersonalCalendar(cal.id, cal.source.name)}
                        trackColor={{ false: Colors.surfaceHighlight, true: "#818cf8" }}
                        thumbColor={isPersonal ? Colors.white : Colors.text.tertiary}
                    />
                </SettingsListItem>

                {isPersonal && (
                    <View className="ml-4 pl-4 border-l-2 border-border/50 mt-1">
                        {/* Default Logic */}
                        <View className="flex-row items-center gap-2 mb-2">
                            <TouchableOpacity
                                onPress={() => setDefaultCreateCalendarId(cal.id)}
                                className={`flex-row items-center gap-1 px-2 py-1 rounded-md border ${isCreateDefault ? 'bg-success border-success' : 'bg-surface border-border'}`}
                            >
                                <Ionicons name="add-circle" size={14} color={isCreateDefault ? Palette[9] : Colors.secondary} />
                                <Text className={`text-xs ${isCreateDefault ? 'text-success font-bold' : 'text-text-tertiary'}`}>
                                    Default Create
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setDefaultOpenCalendarId(cal.id)}
                                className={`flex-row items-center gap-1 px-2 py-1 rounded-md border ${isOpenDefault ? 'bg-warning border-warning' : 'bg-surface border-border'}`}
                            >
                                <Ionicons name="eye" size={14} color={isOpenDefault ? Palette[5] : Colors.secondary} />
                                <Text className={`text-xs ${isOpenDefault ? 'text-warning font-bold' : 'text-text-tertiary'}`}>
                                    Default Open
                                </Text>
                            </TouchableOpacity>
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

    if (loading) {
        return <ActivityIndicator size="small" color="#818cf8" />;
    }

    return (
        <View className="flex-1">
            <View className="bg-surface/50 p-4 rounded-2xl border border-border mb-6">
                <Text className="text-text-secondary font-semibold mb-2">Personal Account</Text>
                <Text className="text-text-tertiary text-sm mb-4">
                    Enter your personal email. Events ONLY with you or your partner will be categorized as "Personal".
                </Text>
                <Input
                    value={personalAccountId || ''}
                    onChangeText={setPersonalAccountId}
                    placeholder="me@gmail.com"
                    autoCapitalize="none"
                />
            </View>

            <View className="mb-4">
                <Text className="text-text-secondary font-semibold mb-2">Personal Calendars</Text>
                <Text className="text-text-tertiary text-sm">
                    Select calendars that belong to your personal life.
                </Text>
            </View>

            <FlatList
                data={calendars}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
            />

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
