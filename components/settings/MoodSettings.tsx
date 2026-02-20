import React, { useState, useEffect } from 'react';
import { View, Text, Switch, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { Card } from '../ui/Card';
import { useMoodStore } from '../../store/moodStore';
import { useSettingsStore } from '../../store/settings';
import { syncMoodReminders } from '../../services/reminderService';
import { Colors } from '../ui/design-tokens';

export function MoodSettings() {
    const { moodReminderEnabled, moodReminderTime, setMoodReminder } = useMoodStore();
    const { timeFormat } = useSettingsStore();
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');

    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        const settings = await Notifications.getPermissionsAsync();
        setPermissionStatus(settings.status);
    };

    const requestPermissions = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);
    };

    const handleToggle = async (val: boolean) => {
        setMoodReminder(val, moodReminderTime);
        await syncMoodReminders();
        if (val && permissionStatus !== 'granted') {
            requestPermissions();
        }
    };

    const handleTimeChange = async (event: any, selectedDate?: Date) => {
        setShowTimePicker(false);
        if (selectedDate) {
            const timeStr = selectedDate.toISOString();
            setMoodReminder(moodReminderEnabled, timeStr);
            if (moodReminderEnabled) {
                await syncMoodReminders();
            }
        }
    };

    const reminderDate = new Date(moodReminderTime);

    return (
        <Card>
            <View className="mb-6">
                <Text className="text-indigo-200 mb-2 font-semibold">Daily Evaluation Reminder</Text>

                <View className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center flex-1">
                        <Ionicons name="notifications-outline" size={20} color="#818cf8" />
                        <View className="ml-3 flex-1">
                            <Text className="text-white font-medium">Enable Reminder</Text>
                            <Text className="text-slate-400 text-xs">Receive a notification to track your mood</Text>
                        </View>
                    </View>
                    <Switch
                        value={moodReminderEnabled}
                        onValueChange={handleToggle}
                        trackColor={{ false: Colors.surfaceHighlight, true: "#4f46e5" }}
                        thumbColor={moodReminderEnabled ? Colors.white : Colors.text.tertiary}
                    />
                </View>

                {moodReminderEnabled && (
                    <View>
                         <Text className="text-slate-400 text-xs mb-2 ml-1">Reminder Time</Text>
                        <TouchableOpacity
                            onPress={() => setShowTimePicker(true)}
                            className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center"
                        >
                            <View className="flex-row items-center">
                                <Ionicons name="time-outline" size={20} color="#818cf8" />
                                <Text className="text-white font-bold text-lg ml-3">
                                    {reminderDate.toLocaleTimeString([], {
                                        hour12: timeFormat === '12h',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.secondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {showTimePicker && (
                    <DateTimePicker
                        value={reminderDate}
                        mode="time"
                        display="default"
                        is24Hour={timeFormat === '24h'}
                        onChange={handleTimeChange}
                    />
                )}
            </View>

            {permissionStatus !== 'granted' && moodReminderEnabled && (
                <View className="mt-2 bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex-row items-center">
                    <Ionicons name="warning-outline" size={20} color={Colors.error} />
                    <Text className="text-red-200 text-sm ml-2 flex-1">
                        Notifications are not enabled. Tap here to fix.
                    </Text>
                    <TouchableOpacity onPress={requestPermissions} className="bg-red-500 px-3 py-1 rounded-lg">
                        <Text className="text-white text-xs font-bold">Fix</Text>
                    </TouchableOpacity>
                </View>
            )}
        </Card>
    );
}
