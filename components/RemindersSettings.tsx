import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { FolderInput } from './ui/FolderInput';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scanForReminders, Reminder, updateReminder, registerReminderTask } from '../services/reminderService';
import { Layout } from './ui/Layout';
import { useSettingsStore } from '../store/settings';
import Toast from 'react-native-toast-message';

export function RemindersSettings() {
    const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
    const [reminders, setReminders] = useState<Reminder[]>([]);
    const [loading, setLoading] = useState(false);
    const { remindersScanFolder, setRemindersScanFolder, vaultUri, backgroundSyncInterval, setBackgroundSyncInterval } = useSettingsStore();
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

    // Edit state
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
    const [editDate, setEditDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        checkPermissions();
        loadReminders();
    }, []);

    // Check folder validity
    const checkFolder = async () => {
        if (!vaultUri || !remindersScanFolder) {
            setFolderStatus('neutral');
            return;
        }
        const { checkDirectoryExists } = await import('../utils/saf');
        const exists = await checkDirectoryExists(vaultUri, remindersScanFolder);
        setFolderStatus(exists ? 'valid' : 'invalid');
    };

    // Reactive folder validation
    useEffect(() => {
        if (!vaultUri || !remindersScanFolder) {
            setFolderStatus('neutral');
            return;
        }
        const timer = setTimeout(() => { checkFolder(); }, 500);
        return () => clearTimeout(timer);
    }, [remindersScanFolder, vaultUri]);

    const checkPermissions = async () => {
        const settings = await Notifications.getPermissionsAsync();
        setPermissionStatus(settings.status);
    };

    const requestPermissions = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status);
        if (status === 'granted') {
            Toast.show({
                type: 'success',
                text1: 'Notifications Enabled',
                text2: 'You will now receive reminders.',
            });
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

    const handleUpdateReminder = async () => {
        if (!editingReminder) return;
        setLoading(true);
        try {
            const newTime = editDate.toISOString();
            await updateReminder(editingReminder.fileUri, newTime);
            setEditingReminder(null);
            await loadReminders(); // Reload list
        } catch (e) {
            Alert.alert("Error", "Failed to update reminder");
        }
        setLoading(false);
    };

    const handleTestNotification = async () => {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "🔔 Test Notification",
                body: "This is how your reminders will look and sound.",
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
        });
        Toast.show({
            type: 'success',
            text1: 'Test Scheduled',
            text2: 'Notification arriving in 2 seconds...',
        });
    };

    const handleSyncIntervalChange = async (minutes: number) => {
        setBackgroundSyncInterval(minutes);
        await registerReminderTask(); // Re-register with new interval
        Toast.show({
            type: 'success',
            text1: 'Sync Interval Updated',
            text2: `Background check set to every ${minutes} minutes.`,
        });
    };

    const handleDeleteReminder = async (reminder: Reminder) => {
        Alert.alert(
            "Disable Reminder",
            "Are you sure you want to remove this reminder?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await updateReminder(reminder.fileUri, null);
                            await loadReminders();
                        } catch (e) {
                            Alert.alert("Error", "Failed to remove reminder");
                        }
                        setLoading(false);
                    }
                }
            ]
        );
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

            <View className="mb-6">
                <FolderInput
                    label="Scan Folder (Optional)"
                    value={remindersScanFolder || ''}
                    onChangeText={setRemindersScanFolder}
                    vaultUri={vaultUri}
                    folderStatus={folderStatus}
                    onCheckFolder={checkFolder}
                    placeholder="Limit scan to specific folder..."
                />
            </View>

            <View className="mb-6">
                <Text className="text-indigo-200 mb-2 font-semibold">Sync Frequency</Text>
                <View className="flex-row flex-wrap gap-2">
                    {[15, 30, 60, 120].map((interval) => (
                        <TouchableOpacity
                            key={interval}
                            onPress={() => handleSyncIntervalChange(interval)}
                            className={`px-4 py-2 rounded-xl border ${backgroundSyncInterval === interval ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
                        >
                            <Text className={`font-medium ${backgroundSyncInterval === interval ? 'text-white' : 'text-slate-400'}`}>
                                {interval < 60 ? `${interval}m` : `${interval / 60}h`}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View className="mb-6">
                 <Button title="🔔 Test Notification" onPress={handleTestNotification} variant="secondary" />
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
                        <View key={index} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center">
                            <View className="flex-1 mr-2">
                                <View className="flex-row items-center mb-1">
                                    <Ionicons name="time-outline" size={16} color="#fbbf24" />
                                    <Text className="text-yellow-400 text-xs font-bold ml-1">
                                        {new Date(reminder.reminderTime).toLocaleString()}
                                    </Text>
                                </View>
                                <Text className="text-white font-bold mb-1">{reminder.fileName}</Text>
                                <Text className="text-slate-400 text-sm" numberOfLines={1}>{reminder.content}</Text>
                            </View>
                            <View className="flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => {
                                        setEditingReminder(reminder);
                                        setEditDate(new Date(reminder.reminderTime));
                                    }}
                                    className="p-2 bg-slate-700 rounded-lg"
                                >
                                    <Ionicons name="pencil" size={16} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDeleteReminder(reminder)}
                                    className="p-2 bg-red-900/50 rounded-lg"
                                >
                                    <Ionicons name="trash" size={16} color="#fca5a5" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Edit Modal */}
            <Modal visible={!!editingReminder} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/50 px-4">
                    <View className="bg-slate-900 w-full max-w-md p-6 rounded-2xl border border-slate-700">
                        <Text className="text-white text-xl font-bold mb-4">Edit Reminder</Text>

                        <View className="mb-6">
                            <Text className="text-indigo-200 mb-2 font-medium">Time</Text>

                            <TouchableOpacity
                                onPress={() => setShowDatePicker(true)}
                                className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-2"
                            >
                                <Text className="text-white text-center font-bold text-lg">
                                    {editDate.toLocaleDateString()}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowTimePicker(true)}
                                className="bg-slate-800 p-4 rounded-xl border border-slate-700"
                            >
                                <Text className="text-white text-center font-bold text-lg">
                                    {editDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={editDate}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) {
                                            // Preserve time
                                            const newDate = new Date(selectedDate);
                                            newDate.setHours(editDate.getHours());
                                            newDate.setMinutes(editDate.getMinutes());
                                            setEditDate(newDate);
                                            // Optional: open time picker immediately after date?
                                            // setShowTimePicker(true);
                                        }
                                    }}
                                />
                            )}

                            {showTimePicker && (
                                <DateTimePicker
                                    value={editDate}
                                    mode="time"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowTimePicker(false);
                                        if (selectedDate) {
                                            // Preserve date
                                            const newDate = new Date(editDate);
                                            newDate.setHours(selectedDate.getHours());
                                            newDate.setMinutes(selectedDate.getMinutes());
                                            setEditDate(newDate);
                                        }
                                    }}
                                />
                            )}
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => setEditingReminder(null)}
                                className="flex-1 bg-slate-800 p-4 rounded-xl items-center"
                            >
                                <Text className="text-white font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUpdateReminder}
                                className="flex-1 bg-indigo-600 p-4 rounded-xl items-center"
                            >
                                <Text className="text-white font-semibold">Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Card>
    );
}
