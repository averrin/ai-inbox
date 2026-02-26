import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { Card } from '../ui/Card';
import { MetadataChip } from '../ui/MetadataChip';
import { PersonalSettings } from './PersonalSettings';
import { WorkSettings } from './WorkSettings';
import { AdditionalCalendars } from './AdditionalCalendars';
import { Colors } from '../ui/design-tokens';

type CalendarSubSection = 'none' | 'personal' | 'work' | 'additional';

export function CalendarsMainSettings({ onBack }: { onBack?: () => void }) {
    const { personalCalendarIds, workCalendarIds, workAccountId, visibleCalendarIds, hideDeclinedEvents, setHideDeclinedEvents } = useSettingsStore();
    const [activeSubSection, setActiveSubSection] = useState<CalendarSubSection>('none');

    const renderMenuButton = (title: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, subtitle?: string, status?: string) => (
        <TouchableOpacity
            onPress={onPress}
            className="bg-surface border border-border rounded-xl p-4 mb-3 flex-row items-center justify-between"
        >
            <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-surface-highlight items-center justify-center mr-3">
                    <Ionicons name={icon} size={20} color="#818cf8" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-white font-semibold text-lg">{title}</Text>
                        {status && (
                            <MetadataChip
                                label={status}
                                variant="solid"
                                color={Colors.primary}
                                size="sm"
                                rounding="sm"
                            />
                        )}
                    </View>
                    {subtitle && <Text className="text-text-tertiary text-sm mt-0.5" numberOfLines={1}>{subtitle}</Text>}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.secondary} className="ml-2" />
        </TouchableOpacity>
    );

    const personalCount = personalCalendarIds.length;
    const workCount = workCalendarIds.length;
    // Count visible calendars that are NOT personal or work
    const additionalCount = visibleCalendarIds.filter(id => !personalCalendarIds.includes(id) && !workCalendarIds.includes(id)).length;

    return (
        <>
            <View className="mb-6">
                <Text className="text-text-secondary font-semibold mb-2 ml-1">Configuration</Text>
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

                <Text className="text-text-secondary font-semibold mb-2 mt-4 ml-1">Visibility</Text>
                <View className="bg-surface border border-border rounded-xl p-4 mb-3 flex-row items-center justify-between">
                    <View className="flex-1 mr-4">
                        <Text className="text-white font-semibold text-lg">Hide Declined Events</Text>
                        <Text className="text-text-tertiary text-sm mt-0.5">Don't show events where you've RSVP'd "No"</Text>
                    </View>
                    <Switch
                        value={hideDeclinedEvents}
                        onValueChange={setHideDeclinedEvents}
                        trackColor={{ false: Colors.surfaceHighlight, true: "#818cf8" }}
                        thumbColor={hideDeclinedEvents ? Colors.white : Colors.text.tertiary}
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
            <Modal visible={activeSubSection !== 'none'} animationType="slide">
                {activeSubSection === 'personal' && <PersonalSettings onBack={() => setActiveSubSection('none')} />}
                {activeSubSection === 'work' && <WorkSettings onBack={() => setActiveSubSection('none')} />}
                {activeSubSection === 'additional' && <AdditionalCalendars onBack={() => setActiveSubSection('none')} />}
            </Modal>
        </>
    );
}
