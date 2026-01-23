import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { FolderInput } from './ui/FolderInput';
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
        vaultUri, 
        backgroundSyncInterval, 
        setBackgroundSyncInterval,
        reminderBypassDnd,
        setReminderBypassDnd,
        reminderVibration,
        setReminderVibration,
        timeFormat,
        setTimeFormat,
        cachedReminders,
        setCachedReminders,
    } = useSettingsStore();
    const reminders = cachedReminders || []; // alias for compatibility, ensure array
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

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
        setCachedReminders(found);
        setLoading(false);
    };

    const handleUpdateReminder = async () => {
        if (!editingReminder) return;
        setLoading(true);
        try {
            const newTime = editDate.toISOString();
            await updateReminder(editingReminder.fileUri, newTime, editRecurrence);
            setEditingReminder(null);
            await loadReminders(); // Reload list
            await syncAllReminders(); // Reschedule notifications
            Toast.show({ type: 'success', text1: 'Reminder Updated' });
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to update reminder");
        }
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
                            await syncAllReminders(); // Clean up notification
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
                    {[5, 15, 30, 60, 120].map((interval) => (
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
    <Text className="text-indigo-200 mb-3 font-semibold">Customization</Text>
    
    <TouchableOpacity 
        onPress={() => { 
            setReminderBypassDnd(!reminderBypassDnd); 
            registerReminderTask(); 
        }} 
        className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-3 flex-row items-center justify-between"
    >
        <View className="flex-row items-center flex-1">
            <Ionicons name="moon-outline" size={20} color="#818cf8" />
            <View className="ml-3 flex-1">
                <Text className="text-white font-medium">Bypass DND</Text>
                <Text className="text-slate-400 text-xs">Sound when DND is on</Text>
            </View>
        </View>
        <View className={`w-12 h-7 rounded-full p-1 ${reminderBypassDnd ? 'bg-indigo-600' : 'bg-slate-700'}`}>
            <View className={`w-5 h-5 rounded-full bg-white ${reminderBypassDnd ? 'ml-auto' : ''}`} />
        </View>
    </TouchableOpacity>
    
    <TouchableOpacity 
        onPress={() => setReminderVibration(!reminderVibration)} 
        className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between mb-3"
    >
        <View className="flex-row items-center flex-1">
            <Ionicons name="phone-portrait-outline" size={20} color="#818cf8" />
            <View className="ml-3 flex-1">
                <Text className="text-white font-medium">Vibration</Text>
                <Text className="text-slate-400 text-xs">Vibrate on reminder</Text>
            </View>
        </View>
        <View className={`w-12 h-7 rounded-full p-1 ${reminderVibration ? 'bg-indigo-600' : 'bg-slate-700'}`}>
            <View className={`w-5 h-5 rounded-full bg-white ${reminderVibration ? 'ml-auto' : ''}`} />
        </View>
    </TouchableOpacity>

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
                <View className="gap-4">
                    {/* Overdue Section */}
                    {(() => {
                        const now = new Date();
                        const overdue = reminders.filter(r => new Date(r.reminderTime) <= now).sort((a,b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());
                        const upcoming = reminders.filter(r => new Date(r.reminderTime) > now).sort((a,b) => new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime());

                        const getRelativeTime = (date: Date) => {
                            const diffMs = date.getTime() - now.getTime();
                            const diffSec = Math.round(diffMs / 1000);
                            const diffMin = Math.round(diffSec / 60);
                            const diffHr = Math.round(diffMin / 60);
                            const diffDay = Math.round(diffHr / 24);


                            
                            if (Math.abs(diffSec) < 60) return 'just now';
                            if (Math.abs(diffMin) < 60) return diffMin > 0 ? `in ${diffMin} min` : `${Math.abs(diffMin)} min ago`;
                            if (Math.abs(diffHr) < 24) return diffHr > 0 ? `in ${diffHr} hr` : `${Math.abs(diffHr)} hr ago`;
                            return diffDay > 0 ? `in ${diffDay} days` : `${Math.abs(diffDay)} days ago`;
                        };

                        return (
                            <>
                                {upcoming.length > 0 && (
                                    <View>
                                        <Text className="text-emerald-400 font-bold mb-2 text-xs uppercase tracking-wider">Upcoming</Text>
                                        <View className="gap-2">
                                            {upcoming.map((reminder, index) => (
                                                <ReminderItem 
                                                    key={reminder.fileUri} 
                                                    reminder={reminder} 
                                                    relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                                                    onEdit={() => { 
                                                        setEditingReminder(reminder); 
                                                        setEditDate(new Date(reminder.reminderTime));
                                                        setEditRecurrence(reminder.recurrenceRule || '');
                                                    }}
                                                    onDelete={() => handleDeleteReminder(reminder)}
                                                    onShow={() => showReminder(reminder)}
                                                    timeFormat={timeFormat}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                )}

                                {overdue.length > 0 && (
                                    <View>
                                        <Text className="text-red-400 font-bold mb-2 text-xs uppercase tracking-wider">Overdue</Text>
                                        <View className="gap-2">
                                            {overdue.map((reminder, index) => (
                                                <ReminderItem 
                                                    key={reminder.fileUri} 
                                                    reminder={reminder} 
                                                    relativeTime={getRelativeTime(new Date(reminder.reminderTime))}
                                                    onEdit={() => { 
                                                        setEditingReminder(reminder); 
                                                        setEditDate(new Date(reminder.reminderTime));
                                                        setEditRecurrence(reminder.recurrenceRule || '');
                                                    }}
                                                    onDelete={() => handleDeleteReminder(reminder)}
                                                    onShow={() => showReminder(reminder)}
                                                    timeFormat={timeFormat}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </>
                        );
                    })()}
                </View>
            )}

            {/* Test Buttons */}
            <View className="mt-8 mb-6 flex-row gap-3">
                <View className="flex-1">
                    <Button title="⏱️ Add Test (30s)" onPress={handleAddTestReminder} variant="secondary" />
                </View>
                <View className="flex-1">
                    <Button title="📱 Test Modal" onPress={handleTestModal} variant="secondary" />
                </View>
            </View>



            {/* Edit Modal */}
            <ReminderEditModal
                visible={!!editingReminder}
                initialDate={editDate}
                initialRecurrence={editRecurrence}
                onSave={async (date, recurrence) => {
                    setEditDate(date);
                    setEditRecurrence(recurrence);
                    // Use the state values set above? No, state updates are async.
                    // We should pass the new values directly to handleUpdateReminder or update state first.
                    // Better yet, update handleUpdateReminder to take args or update state and trigger effect? 
                    // Let's look at handleUpdateReminder: it uses editingReminder, editDate, editRecurrence.
                    
                    // Correct approach: Update state, then call logic. 
                    // But handleUpdateReminder is async. 
                    
                    // Actually, let's just modify handleUpdateReminder to accepting args or modify how it uses state.
                    // Or, simpler:
                    setEditDate(date);
                    setEditRecurrence(recurrence);
                    
                    // Wait for state update? No.
                    // Let's implement a specific save wrapper here.
                    
                    if (!editingReminder) return;
                    setLoading(true);
                    try {
                        const newTime = date.toISOString();
                        await updateReminder(editingReminder.fileUri, newTime, recurrence);
                        setEditingReminder(null);
                        await loadReminders(); 
                        await syncAllReminders(); 
                        Toast.show({ type: 'success', text1: 'Reminder Updated' });
                    } catch (e) {
                        console.error(e);
                        Alert.alert("Error", "Failed to update reminder");
                    }
                    setLoading(false);
                }}
                onCancel={() => setEditingReminder(null)}
                timeFormat={timeFormat}
            />
        </Card>
    );
}


