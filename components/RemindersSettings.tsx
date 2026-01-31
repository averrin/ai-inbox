import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { FolderInput } from './ui/FolderInput';
import { ToggleItem } from './ui/ToggleItem';
import { SegmentedControl } from './ui/SegmentedControl';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { scanForReminders, Reminder, updateReminder, registerReminderTask, syncAllReminders } from '../services/reminderService';
import { Layout } from './ui/Layout';
import { useSettingsStore } from '../store/settings';
import Toast from 'react-native-toast-message';
import { useReminderModal } from '../utils/reminderModalContext';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { ReminderItem } from './ui/ReminderItem';
import { ReminderEditModal } from './ReminderEditModal';

export function RemindersSettings() {
    const { showReminder } = useReminderModal();
    const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');


    const [loading, setLoading] = useState(false);
    const {
        remindersScanFolder,
        setRemindersScanFolder,
        defaultReminderFolder,
        setDefaultReminderFolder,
        vaultUri,
        backgroundSyncInterval,
        setBackgroundSyncInterval,
        reminderBypassDnd,
        setReminderBypassDnd,
        reminderVibration,
        setReminderVibration,
        timeFormat,
        setTimeFormat,
    } = useSettingsStore();
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    const [defaultFolderStatus, setDefaultFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

    // Edit state
    // Edit state
    const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
    const [editDate, setEditDate] = useState<Date>(new Date());
    const [editRecurrence, setEditRecurrence] = useState<string>('');
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

    const checkDefaultFolder = async () => {
        if (!vaultUri || !defaultReminderFolder) {
            setDefaultFolderStatus('neutral');
            return;
        }
        const { checkDirectoryExists } = await import('../utils/saf');
        const exists = await checkDirectoryExists(vaultUri, defaultReminderFolder);
        setDefaultFolderStatus(exists ? 'valid' : 'invalid');
    };

    // Reactive folder validation
    useEffect(() => {
        const timer = setTimeout(() => { checkFolder(); }, 500);
        return () => clearTimeout(timer);
    }, [remindersScanFolder, vaultUri]);

    useEffect(() => {
        const timer = setTimeout(() => { checkDefaultFolder(); }, 500);
        return () => clearTimeout(timer);
    }, [defaultReminderFolder, vaultUri]);

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
        // Just scan to ensure files exist, though UI doesn't show them here anymore
        setLoading(true);
        await scanForReminders();
        setLoading(false);
    };



    const handleAddTestReminder = async () => {
        if (!vaultUri) {
            Alert.alert("Error", "Vault URI not set. Go to Setup -> General to pick a vault.");
            return;
        }

        try {
            const now = new Date();
            const reminderTime = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
            const timeStr = reminderTime.toISOString();

            const fileName = `Test Reminder ${now.getTime()}.md`;
            const fileContent = `---
reminder_datetime: ${timeStr}
---
# Test Reminder
This is a test reminder created at ${now.toLocaleTimeString()} to fire at ${reminderTime.toLocaleTimeString()}.

It should trigger a notification/modal in ~30 seconds.
Ensure the app is in background to test the notification, or foreground to test the modal.`;

            // Determine target folder
            let targetUri = vaultUri;
            if (remindersScanFolder && remindersScanFolder.trim()) {
                const { checkDirectoryExists } = await import('../utils/saf');
                const folderUri = await checkDirectoryExists(vaultUri, remindersScanFolder.trim());
                if (folderUri) {
                    targetUri = folderUri;
                }
            }

            // Create file in the correct scanned location
            const newFileUri = await StorageAccessFramework.createFileAsync(targetUri, fileName, 'text/markdown');
            await StorageAccessFramework.writeAsStringAsync(newFileUri, fileContent);

            Toast.show({
                type: 'success',
                text1: 'Test Reminder Created',
                text2: 'Wait 30s for it to trigger!',
            });

            // Reload list to see it
            loadReminders();

            // Force immediate sync to schedule notification
            await syncAllReminders();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to create test reminder file. Check permissions.");
        }
    };

    const handleTestModal = () => {
        const mockReminder: Reminder = {
            fileUri: 'mock://test',
            fileName: 'Test Reminder.md',
            reminderTime: new Date().toISOString(),
            content: 'This is a test reminder with **bold text** and a link: [Google](https://google.com)\n\nYou can test the postpone functionality and see how the modal looks!'
        };
        showReminder(mockReminder);
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

            <View className="mb-0">
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

            <View className="mb-4">
                <FolderInput
                    label="New Reminders Folder"
                    value={defaultReminderFolder || ''}
                    onChangeText={setDefaultReminderFolder}
                    vaultUri={vaultUri}
                    folderStatus={defaultFolderStatus}
                    onCheckFolder={checkDefaultFolder}
                    placeholder="Where to save new reminders..."
                />
                <Text className="text-slate-500 text-xs mt-0 ml-1">
                    If empty, reminders are saved in the scan folder or vault root.
                </Text>
            </View>


            <View className="mb-6">
                <Text className="text-indigo-200 mb-2 font-semibold">Sync Frequency</Text>
                <SegmentedControl
                    value={backgroundSyncInterval || 15}
                    onChange={handleSyncIntervalChange}
                    options={[5, 15, 30, 60, 120].map(interval => ({
                        label: interval < 60 ? `${interval}m` : `${interval / 60}h`,
                        value: interval
                    }))}
                />
            </View>


            <View className="mb-0">
                <Text className="text-indigo-200 mb-3 font-semibold">Customization</Text>

                <ToggleItem
                    title="Bypass DND"
                    description="Sound when DND is on"
                    icon="moon-outline"
                    value={reminderBypassDnd}
                    onToggle={(val) => {
                        setReminderBypassDnd(val);
                        registerReminderTask();
                    }}
                    className="mb-3"
                />

                <ToggleItem
                    title="Vibration"
                    description="Vibrate on reminder"
                    icon="phone-portrait-outline"
                    value={reminderVibration}
                    onToggle={setReminderVibration}
                    className="mb-3"
                />
            </View>



            {/* Reminder Edit and Active List Removed */}
        </Card>
    );
}


