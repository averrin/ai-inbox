import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { FolderInput } from './ui/FolderInput';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { scanForReminders, Reminder, updateReminder, registerReminderTask, syncAllReminders } from '../services/reminderService';
import { Layout } from './ui/Layout';
import { useSettingsStore } from '../store/settings';
import Toast from 'react-native-toast-message';
import { useReminderModal } from '../utils/reminderModalContext';
import { StorageAccessFramework } from 'expo-file-system/legacy';

export function RemindersSettings() {
    const { showReminder } = useReminderModal();
    const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
    const [reminders, setReminders] = useState<Reminder[]>([]);
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
    } = useSettingsStore();
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
        setReminders(found);
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
                                    {editDate.toLocaleTimeString([], {
                                        hour12: timeFormat === '12h',
                                        hour: '2-digit', 
                                        minute:'2-digit'
                                    })}
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
                                    is24Hour={timeFormat === '24h'}
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
                        
                        {/* Quick Reset Options */}
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium">Reset (Postpone)</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {[{ label: '+5m', min: 5 }, { label: '+15m', min: 15 }, { label: '+1h', min: 60 }, { label: '+1d', min: 1440 }].map((opt) => (
                                    <TouchableOpacity
                                        key={opt.min}
                                        onPress={() => {
                                            const newDate = new Date(Date.now() + opt.min * 60 * 1000);
                                            setEditDate(newDate);
                                        }}
                                        className="bg-slate-700 px-3 py-2 rounded-lg"
                                    >
                                        <Text className="text-white text-xs">{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Recurrence Rule */}
                        <View className="mb-6">
                            <Text className="text-indigo-200 mb-2 font-medium">Recurrence (Optional)</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700"
                                placeholder="e.g. daily, weekly, 3 days"
                                placeholderTextColor="#64748b"
                                value={editRecurrence}
                                onChangeText={setEditRecurrence}
                            />
                            <Text className="text-slate-500 text-xs mt-1">
                                Supported: daily, weekly, monthly, yearly, "2 days", "30 minutes"
                            </Text>
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

function ReminderItem({ reminder, relativeTime, onEdit, onDelete, onShow, timeFormat }: { reminder: Reminder, relativeTime: string, onEdit: () => void, onDelete: () => void, onShow: () => void, timeFormat: '12h'|'24h' }) {
    return (
        <View className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center">
            <View className="flex-1 mr-2">
                <View className="flex-row items-center mb-1 gap-2">
                    <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={16} color="#fbbf24" />
                        <Text className="text-yellow-400 text-xs font-bold ml-1">
                            {new Date(reminder.reminderTime).toLocaleString(undefined, {
                                hour12: timeFormat === '12h', 
                                hour: '2-digit', 
                                minute: '2-digit',
                                day: 'numeric',
                                month: 'short'
                            })}
                        </Text>
                        {reminder.recurrenceRule && (
                             <View className="ml-2 flex-row items-center bg-indigo-900/50 px-1.5 py-0.5 rounded">
                                <Ionicons name="repeat" size={10} color="#818cf8" />
                                <Text className="text-indigo-300 text-[10px] ml-1">{reminder.recurrenceRule}</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-indigo-300 text-xs font-medium">
                        ({relativeTime})
                    </Text>
                </View>
                <Text className="text-white font-bold mb-1">{reminder.fileName}</Text>
                <Text className="text-slate-400 text-sm" numberOfLines={1}>{reminder.content}</Text>
            </View>
            <View className="flex-row gap-2">
                 <TouchableOpacity
                    onPress={onShow}
                    className="p-2 bg-emerald-900/50 rounded-lg"
                >
                    <Ionicons name="play" size={16} color="#4ade80" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onEdit}
                    className="p-2 bg-slate-700 rounded-lg"
                >
                    <Ionicons name="pencil" size={16} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onDelete}
                    className="p-2 bg-red-900/50 rounded-lg"
                >
                    <Ionicons name="trash" size={16} color="#fca5a5" />
                </TouchableOpacity>
            </View>
        </View>
    );
}
