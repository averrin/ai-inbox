import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { scanForReminders, Reminder } from '../services/reminderService';
import { Layout } from './ui/Layout';

export function RemindersSettings() {
    const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkPermissions();
        loadReminders();
    }, []);

    const checkPermissions = async () => {
        const settings = await Notifications.getPermissionsAsync();
        setPermissionStatus(settings.status);
    };

    const requestPermissions = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);
        if (status === 'granted') {
            Alert.alert("Success", "Notifications enabled!");
        } else {
            Alert.alert("Permission Denied", "Enable notifications in system settings to receive reminders.");
        }
    };

    const loadReminders = async () => {
        setLoading(true);
        const found = await scanForReminders();
        setReminders(found);
        setLoading(false);
    };

    return (
        <Card>
            <View className="mb-6">
                <Text className="text-indigo-200 mb-2 font-semibold">Status</Text>
                <View className="flex-row items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <View className="flex-row items-center">
                        <Ionicons
                            name={permissionStatus === 'granted' ? "notifications-outline" : "notifications-off-outline"}
                            size={24}
                            color={permissionStatus === 'granted' ? "#4ade80" : "#ef4444"}
                        />
                        <Text className="text-white font-medium ml-3">
                            {permissionStatus === 'granted' ? "Active" : "Permission Needed"}
                        </Text>
                    </View>
                    {permissionStatus !== 'granted' && (
                        <TouchableOpacity onPress={requestPermissions} className="bg-indigo-600 px-3 py-1.5 rounded-lg">
                            <Text className="text-white text-xs font-bold">Enable</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View className="flex-row items-center justify-between mb-2">
                <Text className="text-indigo-200 font-semibold">Active Reminders</Text>
                <TouchableOpacity onPress={loadReminders} disabled={loading}>
                     {loading ? (
                         <ActivityIndicator size="small" color="#818cf8" />
                     ) : (
                         <Ionicons name="refresh" size={20} color="#818cf8" />
                     )}
                </TouchableOpacity>
            </View>

            {reminders.length === 0 ? (
                <View className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 items-center">
                    <Text className="text-slate-400 italic text-center">No reminders found in vault.</Text>
                    <Text className="text-slate-500 text-xs text-center mt-2">
                        Add 'reminder_datetime: YYYY-MM-DDTHH:mm:ss' to your note's frontmatter.
                    </Text>
                </View>
            ) : (
                <View className="gap-2">
                    {reminders.map((reminder, index) => (
                        <View key={index} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <View className="flex-row items-center mb-1">
                                <Ionicons name="time-outline" size={16} color="#fbbf24" />
                                <Text className="text-yellow-400 text-xs font-bold ml-1">
                                    {new Date(reminder.reminderTime).toLocaleString()}
                                </Text>
                            </View>
                            <Text className="text-white font-bold mb-1">{reminder.fileName}</Text>
                            <Text className="text-slate-400 text-sm" numberOfLines={2}>{reminder.content}</Text>
                        </View>
                    ))}
                </View>
            )}
        </Card>
    );
}
