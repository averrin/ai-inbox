import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../ui/Layout';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useSettingsStore } from '../../store/settings';
import { TaskService } from '../../services/taskService';
import { getWritableCalendars, createCalendarEvent, getCalendarEvents } from '../../services/calendarService';
import { RichTaskItem } from '../markdown/RichTaskItem';
import { ScheduleEvent } from '../ui/calendar/components/ScheduleEvent';
import * as Crypto from 'expo-crypto';
import dayjs from 'dayjs';
import { serializeTaskLine, RichTask } from '../../utils/taskParser';
import Toast from 'react-native-toast-message';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type: 'text' | 'task' | 'event' | 'tasks' | 'events';
    data?: any;
    image?: string; // base64
}

const SYSTEM_PROMPT = `
You are a helpful AI assistant integrated into a productivity app.
Your goal is to help the user manage their tasks and schedule.
You have access to the following tools:
- create_task: Create a new task. Params: title (string), folder (string, optional - use "/" for root), date (YYYY-MM-DD, optional).
- create_event: Create a new calendar event. Params: title (string), start (ISO8601), end (ISO8601), location (optional).
- list_tasks: Search for tasks. Params: query (string, optional).
- list_events: Get calendar events. Params: date (YYYY-MM-DD, optional, defaults to today).
- chat: profound conversation. Params: text (string).

When the user asks to do something, respond with a JSON object representing the action.
Example:
User: "Remind me to buy milk tomorrow"
Assistant: { "action": "create_task", "title": "Buy milk", "date": "2023-10-27" }

User: "What's on my schedule?"
Assistant: { "action": "list_events", "date": "2023-10-26" }

User: "Hello"
Assistant: { "action": "chat", "text": "Hello! How can I help you today?" }

IMPORTANT: Return ONLY the JSON object. Do not wrap it in markdown code blocks.
`;

export default function AssistantScreen() {
    const { apiKey, vaultUri, selectedModel } = useSettingsStore();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        // Initial greeting
        setMessages([{
            id: 'init',
            role: 'assistant',
            content: 'Hello! I can help you manage your tasks and schedule.',
            type: 'text'
        }]);
    }, []);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            base64: true,
            quality: 0.5,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedImage(result.assets[0].base64 || null);
        }
    };

    const handleSendMessage = async () => {
        if ((!inputText.trim() && !selectedImage) || isLoading) return;

        const userMsg: Message = {
            id: Crypto.randomUUID(),
            role: 'user',
            content: inputText,
            type: 'text',
            image: selectedImage || undefined
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSelectedImage(null);
        setIsLoading(true);

        try {
            if (!apiKey) {
                throw new Error("API Key not found. Please set it in Settings.");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: selectedModel || 'gemini-1.5-flash' });

            // Construct history for context (last 5 messages)
            // Note: Gemini API supports chatSession, but for now we'll just append simple history to prompt
            // or use chatSession if possible. Let's use simple prompt construction for maximum control over JSON.

            const history = messages.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
            const prompt = `${SYSTEM_PROMPT}\n\nConversation History:\n${history}\n\nUser: ${userMsg.content}`;

            const parts: any[] = [prompt];
            if (userMsg.image) {
                parts.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: userMsg.image
                    }
                });
            }

            const result = await model.generateContent(parts);
            const responseText = result.response.text();

            // Parse JSON
            let actionData;
            try {
                // simple cleanup
                const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                actionData = JSON.parse(cleanJson);
            } catch (e) {
                console.warn("Failed to parse JSON, treating as chat", responseText);
                actionData = { action: 'chat', text: responseText };
            }

            await handleAction(actionData);

        } catch (error: any) {
            console.error("Assistant Error:", error);
            setMessages(prev => [...prev, {
                id: Crypto.randomUUID(),
                role: 'assistant',
                content: `Error: ${error.message}`,
                type: 'text'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (data: any) => {
        const assistantMsgId = Crypto.randomUUID();
        let assistantMsg: Message = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            type: 'text'
        };

        try {
            switch (data.action) {
                case 'chat':
                    assistantMsg.content = data.text;
                    break;

                case 'create_task':
                    if (!vaultUri) throw new Error("Vault URI not configured.");
                    const folder = data.folder || '';
                    // Resolve folder logic (simplified)
                    // We need a URI for the target folder.
                    // TaskService.findDefaultTaskFile requires a folderUri.
                    // For now, let's assume root if no folder specified, or try to resolve.
                    // Since resolving paths without known structure is hard, we'll use root tasks folder.

                    const { tasksRoot } = require('../../store/tasks').useTasksStore.getState();
                    // We need the URI of tasksRoot.
                    // This is tricky without `ensureDirectory`.
                    // Let's assume vaultUri is the root.

                    const { ensureDirectory } = require('../../utils/saf');
                    let targetUri = vaultUri;
                    if (tasksRoot) {
                         // This is async, simplified for now:
                         // We assume tasks are in vault root or tasksRoot.
                         // For a robust solution we'd need to resolve tasksRoot URI properly.
                         // Let's just use vaultUri for simplicity in this assistant version
                         // or try to import helper.
                    }

                    const defaultFile = await TaskService.findDefaultTaskFile(vaultUri);
                    const newTask: RichTask = {
                        title: data.title,
                        status: ' ',
                        completed: false,
                        properties: data.date ? { date: String(data.date) } : {},
                        tags: [],
                        indentation: '',
                        bullet: '-',
                        originalLine: '' // filled by addTask
                    };

                    const createdTask = await TaskService.addTask(vaultUri, defaultFile.uri, newTask);
                    // Add fileUri for RichTaskItem
                    const fullTask = { ...createdTask, fileUri: defaultFile.uri, fileName: defaultFile.name };

                    assistantMsg.content = `Created task: ${data.title}`;
                    assistantMsg.type = 'task';
                    assistantMsg.data = fullTask;

                    // Refresh Tasks Store
                    const { tasks, setTasks } = require('../../store/tasks').useTasksStore.getState();
                    setTasks([...tasks, fullTask]);
                    break;

                case 'create_event':
                    const calendars = await getWritableCalendars();
                    const targetCal = calendars[0];
                    if (!targetCal) throw new Error("No writable calendar found.");

                    const eventData = {
                        title: data.title,
                        startDate: new Date(data.start),
                        endDate: new Date(data.end),
                        location: data.location
                    };

                    const evtId = await createCalendarEvent(targetCal.id, eventData);

                    assistantMsg.content = `Created event: ${data.title}`;
                    assistantMsg.type = 'event';
                    assistantMsg.data = {
                        title: eventData.title,
                        start: eventData.startDate,
                        end: eventData.endDate,
                        id: evtId,
                        calendarId: targetCal.id,
                        color: targetCal.color
                    };
                    break;

                case 'list_events':
                    const date = data.date ? new Date(data.date) : new Date();
                    const start = dayjs(date).startOf('day').toDate();
                    const end = dayjs(date).endOf('day').toDate();
                    const visibleCalendars = useSettingsStore.getState().visibleCalendarIds;

                    const events = await getCalendarEvents(visibleCalendars, start, end);

                    assistantMsg.content = `Found ${events.length} events for ${dayjs(date).format('YYYY-MM-DD')}`;
                    assistantMsg.type = 'events';
                    assistantMsg.data = events.map(e => ({
                        ...e,
                        start: new Date(e.startDate),
                        end: new Date(e.endDate),
                        color: '#3b82f6'
                    }));
                    break;

                case 'list_tasks':
                    // This is heavy. Let's just search in memory from store for speed
                    const { tasks: allTasks } = require('../../store/tasks').useTasksStore.getState();
                    const query = data.query ? data.query.toLowerCase() : '';

                    const foundTasks = allTasks.filter((t: any) =>
                        !t.completed && (t.title.toLowerCase().includes(query))
                    ).slice(0, 5); // Limit to 5

                    assistantMsg.content = `Found ${foundTasks.length} tasks matching "${query}"`;
                    assistantMsg.type = 'tasks';
                    assistantMsg.data = foundTasks;
                    break;

                default:
                    assistantMsg.content = "I'm not sure how to handle that action.";
            }
        } catch (e: any) {
            console.error("Action failed", e);
            assistantMsg.content = `Failed to perform action: ${e.message}`;
        }

        setMessages(prev => [...prev, assistantMsg]);
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';

        return (
            <View className={`my-2 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
                <View className={`rounded-2xl px-4 py-3 max-w-[85%] ${isUser ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    {item.image && (
                        <Image
                            source={{ uri: `data:image/jpeg;base64,${item.image}` }}
                            style={{ width: 200, height: 200, borderRadius: 8, marginBottom: 8 }}
                        />
                    )}

                    {item.content ? <Text className="text-white text-base">{item.content}</Text> : null}

                    {/* Specialized Content */}
                    {item.type === 'task' && item.data && (
                        <View className="mt-2 bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                             <RichTaskItem
                                task={item.data}
                                onToggle={() => {}}
                                onUpdate={() => {}}
                                onEdit={() => {}} // Could wire this up later
                            />
                        </View>
                    )}

                    {item.type === 'event' && item.data && (
                        <View className="mt-2 bg-slate-900 rounded-lg p-2 border border-slate-700">
                             <ScheduleEvent
                                event={{
                                    ...item.data,
                                    type: 'event', // Basic event type for rendering
                                }}
                                touchableOpacityProps={{ disabled: true }}
                                timeFormat="24h"
                             />
                        </View>
                    )}

                    {item.type === 'tasks' && item.data && Array.isArray(item.data) && (
                        <View className="mt-2 gap-2">
                            {item.data.map((task: any, idx: number) => (
                                <View key={idx} className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                                    <RichTaskItem
                                        task={task}
                                        onToggle={() => {}}
                                        onUpdate={() => {}}
                                    />
                                </View>
                            ))}
                        </View>
                    )}
                     {item.type === 'events' && item.data && Array.isArray(item.data) && (
                        <View className="mt-2 gap-2">
                            {item.data.map((evt: any, idx: number) => (
                                <View key={idx} className="bg-slate-900 rounded-lg p-2 border border-slate-700">
                                    <ScheduleEvent
                                        event={{
                                            ...evt,
                                            type: 'event',
                                            // Ensure colors and titles are present
                                            title: evt.title,
                                            start: evt.start,
                                            end: evt.end
                                        }}
                                        touchableOpacityProps={{ disabled: true }}
                                        timeFormat="24h"
                                    />
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <Layout>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                <View
                    className="p-4 bg-slate-900 border-t border-slate-800 flex-row items-end gap-2"
                    style={{ paddingBottom: isKeyboardVisible ? 16 : (insets.bottom + 80) }}
                >
                    <TouchableOpacity
                        onPress={pickImage}
                        className="p-2 bg-slate-800 rounded-full"
                    >
                        {selectedImage ? (
                            <View className="w-6 h-6 rounded overflow-hidden">
                                <Image source={{ uri: `data:image/jpeg;base64,${selectedImage}` }} className="w-full h-full" />
                            </View>
                        ) : (
                            <Ionicons name="image-outline" size={24} color="#94a3b8" />
                        )}
                    </TouchableOpacity>

                    <View className="flex-1 bg-slate-800 rounded-2xl px-4 py-2 min-h-[44px] max-h-[120px] justify-center">
                        <TextInput
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Type a message..."
                            placeholderTextColor="#64748b"
                            multiline
                            className="text-white text-base max-h-[100px]"
                            style={{ padding: 0 }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSendMessage}
                        disabled={isLoading || (!inputText && !selectedImage)}
                        className={`p-3 rounded-full ${isLoading || (!inputText && !selectedImage) ? 'bg-slate-800' : 'bg-indigo-600'}`}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Ionicons name="send" size={20} color={(!inputText && !selectedImage) ? "#64748b" : "white"} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Layout>
    );
}
