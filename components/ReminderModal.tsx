import { View, Text, Modal, TouchableOpacity, ScrollView, Linking, Vibration, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Reminder, updateReminder, calculateNextRecurrence } from '../services/reminderService';
import { useSettingsStore } from '../store/settings';
import { LongPressButton } from './ui/LongPressButton';
import Toast from 'react-native-toast-message';
import { LinkAttachment } from './ui/LinkAttachment';
import { fetchURLMetadata, URLMetadata, extractURLs } from '../utils/urlMetadata';

interface ReminderModalProps {
    reminder: Reminder | null;
    onClose: () => void;
}

const POSTPONE_PRESETS = [
    { label: '5 min', minutes: 5 },
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '3 hours', minutes: 180 },
];

export function ReminderModal({ reminder, onClose }: ReminderModalProps) {
    const [showPostponeMenu, setShowPostponeMenu] = useState(false);
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [customDate, setCustomDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    // Sound and vibration handled by system notification now
    const { timeFormat } = useSettingsStore();
    
    // Link metadata cache
    const [linkMetadata, setLinkMetadata] = useState<Record<string, URLMetadata>>({});

    useEffect(() => {
        if (reminder) {
            const urls = [...new Set(extractURLs(reminder.content))];
            urls.forEach(async (url) => {
                if (!linkMetadata[url]) {
                    try {
                        const meta = await fetchURLMetadata(url);
                        setLinkMetadata(prev => ({ ...prev, [url]: meta }));
                    } catch (e) {
                        console.error('Failed to fetch metadata for', url, e);
                    }
                }
            });
        }
    }, [reminder]);


    const handlePostpone = async (minutes: number) => {
        if (!reminder) return;

        const newDate = new Date(Date.now() + minutes * 60 * 1000);
        await updateReminderTime(newDate);
    };

    const handleCustomPostpone = async () => {
        if (!reminder) return;
        await updateReminderTime(customDate);
        setShowCustomPicker(false);
    };

    const handleClose = async () => {
        onClose();
    };

    const handleDone = async () => {
        if (reminder && reminder.recurrenceRule) {
             const nextDate = calculateNextRecurrence(new Date(reminder.reminderTime), reminder.recurrenceRule);
             if (nextDate) {
                 await updateReminderTime(nextDate);
                 Toast.show({
                    type: 'success',
                    text1: 'Reminder Rescheduled',
                    text2: `${reminder.recurrenceRule} later`,
                 });
                 // updateReminderTime already closes modal
                 return;
             }
        }
        onClose();
    };

    const updateReminderTime = async (newDate: Date) => {
        if (!reminder) return;

        try {
            const isoString = newDate.toISOString();
            await updateReminder(reminder.fileUri, isoString);
            
            Toast.show({
                type: 'success',
                text1: 'Reminder Postponed',
                text2: `Until ${newDate.toLocaleString()}`,
            });
            
            onClose();
            onClose();
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Failed to Postpone',
                text2: 'Please try again',
            });
        }
    };

    const parseContentForLinks = (content: string) => {
        // Split content by links and return array of text/link components
        const parts: React.ReactElement[] = [];
        let lastIndex = 0;
        let key = 0;

        // Regex that matches:
        // 1. Embed Block: ```embed\s*([\s\S]*?)```
        // 2. Image: !\[(.*?)\]\((.*?)\)
        // 3. Link: \[([^\]]+)\]\(([^)]+)\)
        // 4. Raw URL: (https?:\/\/[^\s]+)
        
        const regex = /(```embed\s*([\s\S]*?)```)|(!\[(.*?)\]\((.*?)\))|(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s]+)/g;
        let match;

        while ((match = regex.exec(content)) !== null) {
            // Group 1: Embed full
            // Group 2: Embed content (YAML-like)
            // Group 3: Image full
            // Group 4: Image Alt
            // Group 5: Image URL
            // Group 6: Link full
            // Group 7: Link Text
            // Group 8: Link URL
            // Group 9: Raw URL

             if (match.index > lastIndex) {
                parts.push(
                    <Text key={`text-${key++}`} className="text-white">
                        {content.substring(lastIndex, match.index)}
                    </Text>
                );
            }

            if (match[1]) {
                // EMBED BLOCK
                const embedContent = match[2];
                const meta: URLMetadata = { url: '', title: '' };
                
                // Simple parsing of YAML-like lines
                const lines = embedContent.split('\n');
                lines.forEach(line => {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        // Handle potential multiple colons in value (like URLs)
                        const value = parts.slice(1).join(':').trim().replace(/^"|"$/g, ''); // Remove quotes
                        
                        if (key === 'title') meta.title = value;
                        if (key === 'url') meta.url = value;
                        if (key === 'image') meta.image = value;
                        if (key === 'description') meta.description = value;
                        if (key === 'favicon') meta.favicon = value;
                    }
                });

                if (meta.url) {
                    parts.push(
                        <View key={`embed-block-${key++}`} className="my-2">
                            <LinkAttachment link={meta} showRemove={false} />
                        </View>
                    );
                }
            } else if (match[3]) {
                // IMAGE
                const imageUrl = match[5];
                parts.push(
                    <View key={`img-${key++}`} className="my-2 rounded-lg overflow-hidden border border-slate-700">
                        <Image 
                            source={{ uri: imageUrl }} 
                            style={{ width: '100%', aspectRatio: 16/9 }} 
                            resizeMode="cover" 
                        />
                    </View>
                );
            } else if (match[6]) {
                // MARKDOWN LINK -> Render as Embed/Card
                const linkText = match[7];
                const linkUrl = match[8];
                
                // Use fetched metadata if available, otherwise fallback to link text/url
                const fetchedMeta = linkMetadata[linkUrl];
                const meta: URLMetadata = fetchedMeta || { 
                    url: linkUrl, 
                    title: linkText || linkUrl 
                };

                parts.push(
                    <View key={`link-md-${key++}`} className="my-2">
                         <LinkAttachment link={meta} showRemove={false} />
                    </View>
                );
            } else if (match[9]) {
                // RAW URL
                const linkUrl = match[9];
                const meta = linkMetadata[linkUrl] || { url: linkUrl, title: linkUrl };
                
                parts.push(
                    <View key={`link-embed-${key++}`} className="my-2">
                        <LinkAttachment link={meta} showRemove={false} />
                    </View>
                );
            }

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            parts.push(
                <Text key={`text-${key++}`} className="text-white">
                    {content.substring(lastIndex)}
                </Text>
            );
        }

        return parts.length > 0 ? parts : [<Text key="default" className="text-white">{content}</Text>];
    };

    if (!reminder) return null;

    return (
        <Modal
            visible={!!reminder}
            transparent
            animationType="fade"
            statusBarTranslucent
            presentationStyle="overFullScreen"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/90 justify-center items-center px-4">
                <View className="bg-slate-900 w-full max-w-lg rounded-2xl border-2 border-indigo-500 overflow-hidden">
                    {/* Header */}
                    <View className="bg-indigo-600 p-4 flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-indigo-500 items-center justify-center mr-3">
                            <Ionicons name="alarm" size={24} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-lg">Reminder</Text>
                            <Text className="text-indigo-100 text-xs">
                                {new Date(reminder.reminderTime).toLocaleString(undefined, {
                                    hour12: timeFormat === '12h',
                                    hour: '2-digit', 
                                    minute: '2-digit',
                                    day: 'numeric',
                                    month: 'short'
                                })}
                            </Text>
                        </View>
                    </View>

                    {/* Content */}
                    <ScrollView className="max-h-96 p-4" showsVerticalScrollIndicator>
                        <Text className="text-white font-bold text-xl mb-3">
                            {reminder.fileName.replace('.md', '')}
                        </Text>
                        <View className="mb-4">
                            {parseContentForLinks(reminder.content)}
                        </View>
                    </ScrollView>

                    {/* Actions */}
                    {/* Actions */}
                    <View className="p-4 border-t border-slate-700">
                        
                        {!showPostponeMenu ? (
                            /* Default View */
                            <View className="gap-3">
                                <View className="flex-row gap-3">
                                     <TouchableOpacity
                                        onPress={() => setShowPostponeMenu(true)}
                                        className="flex-1 bg-slate-800 p-4 rounded-xl items-center flex-row justify-center border border-slate-700"
                                    >
                                        <Ionicons name="time-outline" size={20} color="#fbbf24" style={{ marginRight: 8 }} />
                                        <Text className="text-white font-semibold">Postpone</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            if (reminder) {
                                                const encodedName = encodeURIComponent(reminder.fileName.replace('.md', ''));
                                                Linking.openURL(`obsidian://open?file=${encodedName}`);
                                                onClose();
                                            }
                                        }}
                                        className="flex-1 bg-slate-800 p-4 rounded-xl items-center flex-row justify-center border border-slate-700"
                                    >
                                        <Ionicons name="document-text-outline" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
                                        <Text className="text-white font-semibold">Open Note</Text>
                                    </TouchableOpacity>
                                </View>

                                <LongPressButton
                                    onPress={handleDone}
                                    onLongPress={async () => {
                                        if (reminder) {
                                            try {
                                                 const { StorageAccessFramework } = require('expo-file-system/legacy');
                                                 await StorageAccessFramework.deleteAsync(reminder.fileUri);
                                                 Toast.show({ type: 'success', text1: 'Note Deleted' });
                                                 onClose();
                                            } catch (e) {
                                                Toast.show({ type: 'error', text1: 'Failed to delete note' });
                                            }
                                        }
                                    }}
                                    shortPressLabel="Done"
                                    longPressLabel="Delete Note"
                                    style={{ width: '100%' }}
                                />
                            </View>
                        ) : (
                            /* Postpone View */
                            <View>
                                <View className="flex-row justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                    <Text className="text-white font-bold text-lg">Snooze for...</Text>
                                    <TouchableOpacity onPress={() => setShowPostponeMenu(false)}>
                                        <Text className="text-indigo-400 font-medium">Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                                
                                <View className="flex-row flex-wrap gap-2 mb-4">
                                    {POSTPONE_PRESETS.map((preset) => (
                                        <TouchableOpacity
                                            key={preset.minutes}
                                            onPress={() => handlePostpone(preset.minutes)}
                                            className="bg-slate-700 flex-grow px-4 py-3 rounded-xl items-center border border-slate-600"
                                            style={{ minWidth: '30%' }}
                                        >
                                            <Text className="text-white font-medium">{preset.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomDate(new Date());
                                        setShowCustomPicker(true);
                                    }}
                                    className="bg-indigo-600/20 border border-indigo-500/50 p-4 rounded-xl items-center flex-row justify-center"
                                >
                                    <Ionicons name="calendar-outline" size={20} color="#818cf8" style={{ marginRight: 8 }} />
                                    <Text className="text-indigo-200 font-semibold">Pick Date & Time</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        
                        {/* Custom Date/Time Picker Overlay (hidden by logic if !showCustomPicker) */}
                        {showCustomPicker && (
                            <View className="bg-slate-800 absolute bottom-0 left-0 right-0 p-4 rounded-t-2xl border-t border-slate-700 shadow-2xl z-50">
                                <Text className="text-indigo-200 font-semibold mb-4 text-center">Set Custom Time</Text>
                                
                                <View className="flex-row gap-3 mb-4">
                                    <TouchableOpacity
                                        onPress={() => setShowDatePicker(true)}
                                        className="flex-1 bg-slate-700 p-3 rounded-xl items-center"
                                    >
                                        <Text className="text-slate-400 text-xs mb-1">Date</Text>
                                        <Text className="text-white text-lg font-bold">
                                            {customDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setShowTimePicker(true)}
                                        className="flex-1 bg-slate-700 p-3 rounded-xl items-center"
                                    >
                                        <Text className="text-slate-400 text-xs mb-1">Time</Text>
                                        <Text className="text-white text-lg font-bold">
                                            {customDate.toLocaleTimeString([], {
                                                hour12: timeFormat === '12h',
                                                hour: '2-digit', 
                                                minute:'2-digit'
                                            })}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                                
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={customDate}
                                        mode="date"
                                        display="default"
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(false);
                                            if (selectedDate) {
                                                const newDate = new Date(selectedDate);
                                                newDate.setHours(customDate.getHours());
                                                newDate.setMinutes(customDate.getMinutes());
                                                setCustomDate(newDate);
                                            }
                                        }}
                                    />
                                )}

                                {showTimePicker && (
                                    <DateTimePicker
                                        value={customDate}
                                        mode="time"
                                        display="default"
                                        is24Hour={timeFormat === '24h'}
                                        onChange={(event, selectedDate) => {
                                            setShowTimePicker(false);
                                            if (selectedDate) {
                                                const newDate = new Date(customDate);
                                                newDate.setHours(selectedDate.getHours());
                                                newDate.setMinutes(selectedDate.getMinutes());
                                                setCustomDate(newDate);
                                            }
                                        }}
                                    />
                                )}

                                <View className="flex-row gap-3">
                                    <TouchableOpacity
                                        onPress={() => setShowCustomPicker(false)}
                                        className="flex-1 bg-slate-700 p-4 rounded-xl items-center"
                                    >
                                        <Text className="text-white font-semibold">Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleCustomPostpone}
                                        className="flex-1 bg-indigo-600 p-4 rounded-xl items-center"
                                    >
                                        <Text className="text-white font-semibold">Set Reminder</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
