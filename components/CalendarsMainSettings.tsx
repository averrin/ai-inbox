import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../store/settings';
import { Card } from './ui/Card';
import { PersonalSettings } from './PersonalSettings';
import { WorkSettings } from './WorkSettings';
import { AdditionalCalendars } from './AdditionalCalendars';

type CalendarSubSection = 'none' | 'personal' | 'work' | 'additional';

export function CalendarsMainSettings() {
    const { personalCalendarIds, workCalendarIds, workAccountId, visibleCalendarIds, hideDeclinedEvents, setHideDeclinedEvents } = useSettingsStore();
    const [activeSubSection, setActiveSubSection] = useState<CalendarSubSection>('none');

    const renderMenuButton = (title: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, subtitle?: string, status?: string) => (
        <TouchableOpacity
            onPress={onPress}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-3 flex-row items-center justify-between"
        >
            <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-slate-700 items-center justify-center mr-3">
                    <Ionicons name={icon} size={20} color="#818cf8" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-white font-semibold text-lg">{title}</Text>
                        {status && (
                            <View className="bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/30">
                                <Text className="text-indigo-400 text-[10px] font-bold">{status}</Text>
                            </View>
                        )}
                    </View>
                    {subtitle && <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{subtitle}</Text>}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" className="ml-2" />
        </TouchableOpacity>
    );

    const renderModalHeader = (title: string) => (
        <View className="flex-row items-center justify-between mb-6">
            <Text className="text-white text-xl font-bold">{title}</Text>
            <TouchableOpacity onPress={() => setActiveSubSection('none')} className="p-2">
                <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
        </View>
    );

    const personalCount = personalCalendarIds.length;
    const workCount = workCalendarIds.length;
    // Count visible calendars that are NOT personal or work
    const additionalCount = visibleCalendarIds.filter(id => !personalCalendarIds.includes(id) && !workCalendarIds.includes(id)).length;

    return (
        <View className="flex-1 px-4 mt-2">
            <View className="mb-6">
                <Text className="text-indigo-200 font-semibold mb-2 ml-1">Configuration</Text>
                {renderMenuButton(
                    "Personal",
                    "person-outline",
                    () => setActiveSubSection('personal'),
                    "Private life & habits",
                    `${personalCount} Active`
                )}
                {renderMenuButton(
                    "Work",
                    "briefcase-outline",
                    () => setActiveSubSection('work'),
                    workAccountId || "Set work account email",
                    `${workCount} Active`
                )}

                <Text className="text-indigo-200 font-semibold mb-2 mt-4 ml-1">Visibility</Text>
                <View className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-3 flex-row items-center justify-between">
                    <View className="flex-1 mr-4">
                        <Text className="text-white font-semibold text-lg">Hide Declined Events</Text>
                        <Text className="text-slate-400 text-sm mt-0.5">Don't show events where you've RSVP'd "No"</Text>
                    </View>
                    <Switch
                        value={hideDeclinedEvents}
                        onValueChange={setHideDeclinedEvents}
                        trackColor={{ false: "#334155", true: "#818cf8" }}
                        thumbColor={hideDeclinedEvents ? "#ffffff" : "#94a3b8"}
                    />
                </View>

                {renderMenuButton(
                    "Additional Calendars",
                    "calendar-outline",
                    () => setActiveSubSection('additional'),
                    "Shared & other calendars",
                    `${additionalCount} Visible`
                )}
            </View>

            {/* Sub-section Modals */}
            <Modal visible={activeSubSection !== 'none'} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-slate-900 rounded-t-3xl p-6 h-[90%]">
                        {activeSubSection === 'personal' && (
                            <>
                                {renderModalHeader("Personal Calendar")}
                                <PersonalSettings />
                            </>
                        )}
                        {activeSubSection === 'work' && (
                            <>
                                {renderModalHeader("Work Calendar")}
                                <WorkSettings />
                            </>
                        )}
                        {activeSubSection === 'additional' && (
                            <>
                                {renderModalHeader("Additional Calendars")}
                                <AdditionalCalendars />
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
