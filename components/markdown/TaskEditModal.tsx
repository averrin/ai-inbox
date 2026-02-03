import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { RichTask } from '../../utils/taskParser';
import { PropertyEditor } from '../ui/PropertyEditor';
import { TagEditor } from '../ui/TagEditor';
import { useSettingsStore } from '../../store/settings';
import { TaskWithSource } from '../../store/tasks';
import { useVaultStore } from '../../services/vaultService';
import { openInObsidian } from '../../utils/obsidian';
import { ReminderItem } from '../ui/ReminderItem';
import { ReminderEditModal, ReminderSaveData } from '../ReminderEditModal';
import {
    REMINDER_PROPERTY_KEY,
    RECURRENT_PROPERTY_KEY,
    ALARM_PROPERTY_KEY,
    PERSISTENT_PROPERTY_KEY,
    createStandaloneReminder
} from '../../services/reminderService';

interface TaskEditModalProps {
    visible: boolean;
    task: (RichTask & { fileUri?: string }) | null;
    onSave: (task: RichTask) => void;
    onCancel: () => void;
}

export function TaskEditModal({ visible, task, onSave, onCancel }: TaskEditModalProps) {
    const { propertyConfig, vaultUri } = useSettingsStore();
    const { metadataCache } = useVaultStore();
    
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState(' ');
    const [properties, setProperties] = useState<Record<string, any>>({});
    const [tags, setTags] = useState<string[]>([]);
    const [showReminderModal, setShowReminderModal] = useState(false);
    
    // Derived from settings for autocomplete
    const keySuggestions = Object.keys(propertyConfig);

    useEffect(() => {
        if (visible) {
            if (task) {
                setTitle(task.title);
                setStatus(task.status);
                setProperties({ ...task.properties }); // Clone to avoid mutation
                setTags([...task.tags]);
            } else {
                setTitle('');
                setStatus(' ');
                setProperties({});
                setTags([]);
            }
        }
    }, [task, visible]);

    const handleAddTag = (tag: string) => {
        const cleanTag = tag.trim().replace(/^#/, '');
        if (cleanTag && !tags.includes(cleanTag)) {
            setTags([...tags, cleanTag]);
        }
    };

    const handleRemoveTag = (index: number) => {
        setTags(tags.filter((_, i) => i !== index));
    };

    const handleReminderSave = (data: ReminderSaveData) => {
        const newProps = { ...properties };
        newProps[REMINDER_PROPERTY_KEY] = data.date.toISOString();

        if (data.recurrence) {
            newProps[RECURRENT_PROPERTY_KEY] = data.recurrence;
        } else {
            delete newProps[RECURRENT_PROPERTY_KEY];
        }

        if (data.alarm) {
            newProps[ALARM_PROPERTY_KEY] = 'true';
        } else {
            delete newProps[ALARM_PROPERTY_KEY];
        }

        if (data.persistent) {
            newProps[PERSISTENT_PROPERTY_KEY] = data.persistent.toString();
        } else {
            delete newProps[PERSISTENT_PROPERTY_KEY];
        }

        setProperties(newProps);
        setShowReminderModal(false);
    };

    const handleReminderDelete = () => {
        const newProps = { ...properties };
        delete newProps[REMINDER_PROPERTY_KEY];
        delete newProps[RECURRENT_PROPERTY_KEY];
        delete newProps[ALARM_PROPERTY_KEY];
        delete newProps[PERSISTENT_PROPERTY_KEY];
        setProperties(newProps);
    };

    const reminderDate = properties[REMINDER_PROPERTY_KEY]
        ? new Date(properties[REMINDER_PROPERTY_KEY])
        : undefined;

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Validation', 'Task title cannot be empty.');
            return;
        }

        // Logic to extract task to file if it has a reminder and is not already a link
        const hasReminder = !!properties[REMINDER_PROPERTY_KEY];
        const isWikiLink = /^\[\[.*\]\]$/.test(title.trim());

        if (hasReminder && !isWikiLink) {
            // Extract to new file
            const reminderDate = properties[REMINDER_PROPERTY_KEY];
            const recurrence = properties[RECURRENT_PROPERTY_KEY];
            const alarm = properties[ALARM_PROPERTY_KEY] === 'true';
            const persistent = properties[PERSISTENT_PROPERTY_KEY] ? parseInt(properties[PERSISTENT_PROPERTY_KEY]) : undefined;

            // Prepare extra props (excluding reminder props which are passed explicitly)
            const extraProps: Record<string, any> = {};
            Object.entries(properties).forEach(([k, v]) => {
                if (![REMINDER_PROPERTY_KEY, RECURRENT_PROPERTY_KEY, ALARM_PROPERTY_KEY, PERSISTENT_PROPERTY_KEY].includes(k)) {
                    extraProps[k] = v;
                }
            });

            const result = await createStandaloneReminder(
                reminderDate,
                title,
                recurrence,
                alarm,
                persistent,
                extraProps,
                tags
            );

            if (result) {
                // Update task to be a link to the new file
                // Remove extension from filename for cleaner link
                const linkName = result.fileName.replace(/\.md$/i, '');

                // Construct replacement task
                // We remove reminder properties from the list item since they are now in the file
                const newProps = { ...properties };
                delete newProps[REMINDER_PROPERTY_KEY];
                delete newProps[RECURRENT_PROPERTY_KEY];
                delete newProps[ALARM_PROPERTY_KEY];
                delete newProps[PERSISTENT_PROPERTY_KEY];

                const updatedTask: RichTask = {
                    title: `[[${linkName}]]`,
                    status,
                    completed: status === 'x',
                    properties: newProps,
                    tags, // Keep tags on list item too? Yes, useful for filtering.
                    indentation: task?.indentation || '',
                    originalLine: task?.originalLine || '',
                };
                onSave(updatedTask);
                return;
            } else {
                 Alert.alert("Error", "Failed to create reminder file.");
                 return;
            }
        }

        const updatedTask: RichTask = {
            title,
            status,
            completed: status === 'x',
            properties,
            tags,
            indentation: task?.indentation || '',
            originalLine: task?.originalLine || '',
        };
        onSave(updatedTask);
    };

    const handleOpenNote = () => {
        if (!task || !task.fileUri || !vaultUri) return;
        onCancel(); // Close modal first
        openInObsidian(vaultUri, task.fileUri);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center items-center bg-black/50 px-4"
            >
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700 max-h-[80%]">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">{task ? 'Edit Task' : 'New Task'}</Text>
                        <View className="flex-row gap-2">
                             {task && (
                                <TouchableOpacity onPress={handleOpenNote} className="p-2 bg-slate-800 rounded-lg">
                                    <Ionicons name="document-text-outline" size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onCancel} className="p-2">
                                <Ionicons name="close" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium text-xs uppercase tracking-wider">Title</Text>
                            <TextInput
                                className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 font-medium"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Task title..."
                                placeholderTextColor="#64748b"
                                multiline
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium text-xs uppercase tracking-wider">Priority</Text>
                            <View className="flex-row gap-2">
                                {[
                                    { id: 'high', icon: 'arrow-up-circle', label: 'High', color: '#ef4444' },
                                    { id: 'medium', icon: 'remove-circle', label: 'Medium', color: '#f59e0b' },
                                    { id: 'low', icon: 'arrow-down-circle', label: 'Low', color: '#22c55e' },
                                    { id: 'clear', icon: 'close-circle', label: 'None', color: '#94a3b8' },
                                ].map((p) => {
                                    const isSelected = p.id === 'clear' ? !properties.priority : properties.priority === p.id;
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            onPress={() => {
                                                const newProps = { ...properties };
                                                if (p.id === 'clear') {
                                                    delete newProps.priority;
                                                } else {
                                                    newProps.priority = p.id;
                                                }
                                                setProperties(newProps);
                                            }}
                                            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl border ${isSelected ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
                                        >
                                            <Ionicons 
                                                name={p.icon as any} 
                                                size={16} 
                                                color={isSelected ? '#818cf8' : p.color} 
                                            />
                                            <Text className={`ml-1.5 text-xs font-medium ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                                                {p.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 font-medium text-xs uppercase tracking-wider">Reminder</Text>
                            {reminderDate ? (
                                <View className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                    <ReminderItem
                                        reminder={{
                                            fileUri: task?.fileUri || '',
                                            fileName: title,
                                            title: title,
                                            reminderTime: properties[REMINDER_PROPERTY_KEY],
                                            recurrenceRule: properties[RECURRENT_PROPERTY_KEY],
                                            alarm: properties[ALARM_PROPERTY_KEY] === 'true',
                                            persistent: properties[PERSISTENT_PROPERTY_KEY] ? parseInt(properties[PERSISTENT_PROPERTY_KEY]) : undefined,
                                            content: title
                                        }}
                                        timeFormat="12h"
                                        onEdit={() => setShowReminderModal(true)}
                                        onDelete={handleReminderDelete}
                                        showActions={true}
                                    />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setShowReminderModal(true)}
                                    className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex-row items-center justify-center border-dashed"
                                >
                                    <Ionicons name="alarm-outline" size={20} color="#94a3b8" />
                                    <Text className="text-slate-400 ml-2 font-medium">Add Reminder</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="mb-4">
                            <PropertyEditor
                                label="Properties"
                                properties={properties}
                                onUpdate={setProperties}
                                metadataCache={metadataCache}
                            />
                        </View>

                        <View className="mb-6">
                            <TagEditor
                                label="Tags"
                                tags={tags}
                                onAddTag={handleAddTag}
                                onRemoveTag={handleRemoveTag}
                            />
                        </View>
                    </ScrollView>

                    <View className="flex-row gap-3 mt-4">
                        <TouchableOpacity
                            onPress={onCancel}
                            className="flex-1 bg-slate-800 p-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            className="flex-1 bg-indigo-600 p-3 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <ReminderEditModal
                visible={showReminderModal}
                initialDate={reminderDate}
                initialRecurrence={properties[RECURRENT_PROPERTY_KEY]}
                initialAlarm={properties[ALARM_PROPERTY_KEY] === 'true'}
                initialPersistent={properties[PERSISTENT_PROPERTY_KEY] ? parseInt(properties[PERSISTENT_PROPERTY_KEY]) : undefined}
                initialTitle={title}
                enableTitle={false}
                onSave={handleReminderSave}
                onCancel={() => setShowReminderModal(false)}
                timeFormat="12h"
            />
        </Modal>
    );
}
