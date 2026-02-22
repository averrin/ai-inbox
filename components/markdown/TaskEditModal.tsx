import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Calendar from 'expo-calendar';
import dayjs from 'dayjs';
import { RichTask } from '../../utils/taskParser';
import { PropertyEditor } from '../ui/PropertyEditor';
import { TagEditor } from '../ui/TagEditor';
import { useSettingsStore } from '../../store/settings';
import { TaskWithSource, useTasksStore } from '../../store/tasks';
import { useVaultStore } from '../../services/vaultService';
import { openInObsidian } from '../../utils/obsidian';
import { ReminderItem } from '../ui/ReminderItem';
import { EventFormModal, EventSaveData } from '../EventFormModal';
import {
    REMINDER_PROPERTY_KEY,
    RECURRENT_PROPERTY_KEY,
    ALARM_PROPERTY_KEY,
    PERSISTENT_PROPERTY_KEY,
    createStandaloneReminder,
    updateReminder,
    formatRecurrenceForReminder
} from '../../services/reminderService';
import { getParentFolderUri, findFile } from '../../utils/saf';
import { TaskStatusIcon, getStatusConfig } from '../ui/TaskStatusIcon';
import { FolderInput } from '../ui/FolderInput';
import { Colors, Palette } from '../ui/design-tokens';
import { showAlert, showError } from '../../utils/alert';

interface TaskEditModalProps {
    visible: boolean;
    task: (RichTask & { fileUri?: string }) | null;
    onSave: (task: RichTask, folderPath?: string) => void;
    onCancel: () => void;
    onOpenEvent?: (id: string) => void;
    initialFolder?: string;
    enableFolderSelection?: boolean;
    onDelete?: (task: RichTask & { fileUri?: string }) => void;
}

export function TaskEditModal({
    visible,
    task,
    onSave,
    onCancel,
    onOpenEvent,
    initialFolder,
    enableFolderSelection = true,
    onDelete
}: TaskEditModalProps) {
    const { propertyConfig, vaultUri, timeFormat } = useSettingsStore();
    const { tasksRoot } = useTasksStore();
    const { metadataCache } = useVaultStore();

    const [title, setTitle] = useState('');
    const [status, setStatus] = useState(' ');
    const [properties, setProperties] = useState<Record<string, any>>({});
    const [tags, setTags] = useState<string[]>([]);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [linkedEvents, setLinkedEvents] = useState<{ id: string, title: string, date: Date }[]>([]);
    const [folder, setFolder] = useState('');

    // Derived from settings for autocomplete
    const keySuggestions = Object.keys(propertyConfig);

    useEffect(() => {
        if (visible) {
            if (task) {
                setTitle(task.title);
                setStatus(task.status);
                setProperties({ ...task.properties }); // Clone to avoid mutation
                setTags([...task.tags]);

                // Initialize folder from task location if available
                if ((task as any).filePath) {
                    const fp = (task as any).filePath;
                    const parts = fp.split('/');
                    if (parts.length > 1) {
                        parts.pop(); // Remove filename
                        let fullPath = parts.join('/');
                        if (tasksRoot && fullPath.startsWith(tasksRoot)) {
                            fullPath = fullPath.substring(tasksRoot.length).replace(/^\//, '');
                        }
                        setFolder(fullPath);
                    } else {
                        setFolder('');
                    }
                } else if (initialFolder !== undefined) {
                    let rel = initialFolder;
                    if (tasksRoot && rel.startsWith(tasksRoot)) {
                        rel = rel.substring(tasksRoot.length).replace(/^\//, '');
                    }
                    setFolder(rel);
                } else {
                    setFolder('');
                }
            } else {
                setTitle('');
                setStatus(' ');
                setProperties({});
                setTags([]);

                // New Task Folder
                if (initialFolder !== undefined) {
                    let rel = initialFolder;
                    if (tasksRoot && rel.startsWith(tasksRoot)) {
                        rel = rel.substring(tasksRoot.length).replace(/^\//, '');
                    }
                    setFolder(rel);
                } else {
                    setFolder('');
                }
            }
        }
    }, [task, visible, initialFolder, tasksRoot]);

    useEffect(() => {
        const loadLinkedEvents = async () => {
            if (task && task.properties['event_id']) {
                const ids = task.properties['event_id'].split(',').map(s => s.trim());
                const events: any[] = [];
                for (const id of ids) {
                    if (!id) continue;
                    try {
                        const evt = await Calendar.getEventAsync(id);
                        if (evt) {
                            events.push({
                                id: evt.id,
                                title: task.properties.event_title || evt.title,
                                date: new Date(evt.startDate)
                            });
                        }
                    } catch (e) {
                        // console.warn(`Failed to load event ${id}`, e);
                        events.push({
                            id,
                            title: task.properties.event_title || 'Unknown Event',
                            date: new Date()
                        });
                    }
                }
                setLinkedEvents(events);
            } else {
                setLinkedEvents([]);
            }
        };
        if (visible) loadLinkedEvents();
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

    const handleReminderSave = (data: EventSaveData) => {
        const newProps = { ...properties };
        newProps[REMINDER_PROPERTY_KEY] = data.startDate.toISOString();

        const recurrence = formatRecurrenceForReminder(data.recurrenceRule);
        if (recurrence) {
            newProps[RECURRENT_PROPERTY_KEY] = recurrence;
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
            showAlert('Validation', 'Task title cannot be empty.');
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
                tags,
                task?.fileUri
            );

            if (result) {
                // Update task to be a link to the new file
                // Remove extension from filename for cleaner link
                const linkName = result.fileName.replace(/\.md$/i, '');

                // Construct replacement task
                // We keep REMINDER_PROPERTY_KEY for visual indicator in the list
                // But remove config flags to avoid confusion/double-logic (though scan doesn't check list items)
                const newProps = { ...properties };
                // delete newProps[REMINDER_PROPERTY_KEY]; // Keep for indicator
                delete newProps[RECURRENT_PROPERTY_KEY];
                delete newProps[ALARM_PROPERTY_KEY];
                delete newProps[PERSISTENT_PROPERTY_KEY];

                const updatedTask: RichTask = {
                    title: `[[${linkName}]]`,
                    bullet: task?.bullet || '-',
                    status,
                    completed: status === 'x',
                    properties: newProps,
                    tags, // Keep tags on list item too? Yes, useful for filtering.
                    indentation: task?.indentation || '',
                    originalLine: task?.originalLine || '',
                };

                const fullFolder = tasksRoot ? (folder ? `${tasksRoot}/${folder}` : tasksRoot) : folder;
                onSave(updatedTask, fullFolder);
                return;
            } else {
                showError("Error", "Failed to create reminder file.");
                return;
            }
        } else if (isWikiLink && vaultUri && task?.fileUri) {
            // Check if we need to sync reminder changes to the linked file
            const match = title.trim().match(/^\[\[(.*)\]\]$/);
            const linkedFileName = match ? match[1] : null;

            if (linkedFileName) {
                try {
                    // Try to resolve linked file in sibling folder first
                    const parentUri = await getParentFolderUri(vaultUri, task.fileUri);
                    let linkedFileUri = null;

                    if (parentUri) {
                        linkedFileUri = await findFile(parentUri, linkedFileName + '.md');
                    }

                    // Fallback to vault root if not found
                    if (!linkedFileUri) {
                        linkedFileUri = await findFile(vaultUri, linkedFileName + '.md');
                    }

                    if (linkedFileUri) {
                        if (hasReminder) {
                            const reminderDate = properties[REMINDER_PROPERTY_KEY];
                            const recurrence = properties[RECURRENT_PROPERTY_KEY];
                            const alarm = properties[ALARM_PROPERTY_KEY] === 'true';
                            const persistent = properties[PERSISTENT_PROPERTY_KEY] ? parseInt(properties[PERSISTENT_PROPERTY_KEY]) : undefined;

                            await updateReminder(
                                linkedFileUri,
                                reminderDate,
                                recurrence,
                                alarm,
                                persistent
                            );
                        } else {
                            // Reminder removed - clear it from file
                            await updateReminder(linkedFileUri, null);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to sync reminder to linked file:', e);
                }
            }
        }

        const updatedTask: RichTask = {
            title,
            bullet: task?.bullet || '-',
            status,
            completed: status === 'x',
            properties,
            tags,
            indentation: task?.indentation || '',
            originalLine: task?.originalLine || '',
        };

        const fullFolder = tasksRoot ? (folder ? `${tasksRoot}/${folder}` : tasksRoot) : folder;
        await onSave(updatedTask, fullFolder);
    };

    const handleOpenNote = () => {
        if (!task || !task.fileUri || !vaultUri) return;
        onCancel(); // Close modal first
        openInObsidian(vaultUri, task.fileUri);
    };

    const isAlarm = properties[ALARM_PROPERTY_KEY] === 'true';

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center items-center bg-black/50 px-4"
            >
                <View className="bg-background w-full max-w-md p-6 rounded-3xl border border-border max-h-[80%]">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">{(task && task.fileUri) ? 'Edit Task' : 'New Task'}</Text>
                        <View className="flex-row gap-2">
                            {task && task.fileUri && (
                                <TouchableOpacity onPress={handleOpenNote} className="p-2 bg-surface rounded-lg">
                                    <Ionicons name="document-text-outline" size={20} color={Colors.text.tertiary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onCancel} className="p-2">
                                <Ionicons name="close" size={24} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <View className="mb-4">
                            <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">Title</Text>
                            <TextInput
                                className="bg-surface text-white p-4 rounded-xl border border-border font-medium"
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Task title..."
                                placeholderTextColor={Colors.secondary}
                                multiline
                            />
                        </View>

                        {enableFolderSelection && (
                            <FolderInput
                                label="Folder"
                                value={folder}
                                onChangeText={setFolder}
                                vaultUri={vaultUri}
                                basePath={tasksRoot}
                                placeholder="subfolder..."
                                compact={true}
                            />
                        )}

                        {linkedEvents.length > 0 && (
                            <View className="mb-4">
                                <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">Linked Events</Text>
                                <View className="gap-2">
                                    {linkedEvents.map((evt, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            onPress={() => onOpenEvent && onOpenEvent(evt.id)}
                                            className="bg-surface p-3 rounded-xl border border-border flex-row items-center gap-2"
                                        >
                                            <Ionicons name="calendar-outline" size={16} color="#818cf8" />
                                            <View className="flex-1">
                                                <Text className="text-white font-medium" numberOfLines={1}>{evt.title}</Text>
                                                <Text className="text-secondary text-xs">{dayjs(evt.date).format('dddd, MMM D, h:mm A')}</Text>
                                            </View>
                                            {onOpenEvent && (
                                                <Ionicons name="chevron-forward" size={16} color="#475569" />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View className="mb-4">
                            <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">Status</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {[' ', 'x', '/', '?', '>', '-'].map((id) => {
                                    const s = getStatusConfig(id);
                                    const isSelected = status === id;
                                    return (
                                        <TouchableOpacity
                                            key={id}
                                            onPress={() => setStatus(id)}
                                            className={`flex-row items-center justify-center py-2 px-3 rounded-xl border ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                                            style={{ minWidth: '30%' }}
                                        >
                                            <TaskStatusIcon status={id} size={16} color={isSelected ? Colors.white : undefined} />
                                            <Text className={`ml-1.5 text-xs font-medium ${isSelected ? 'text-white' : 'text-text-tertiary'}`}>
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">Priority</Text>
                            <View className="flex-row gap-2">
                                {[
                                    { id: 'high', icon: 'arrow-up-circle', label: 'High', color: Colors.error },
                                    { id: 'medium', icon: 'remove-circle', label: 'Medium', color: Palette[5] },
                                    { id: 'low', icon: 'arrow-down-circle', label: 'Low', color: Colors.success },
                                    { id: 'clear', icon: 'close-circle', label: 'None', color: Colors.text.tertiary },
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
                                            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl border ${isSelected ? 'bg-primary border-primary' : 'bg-surface border-border'}`}
                                        >
                                            <Ionicons
                                                name={p.icon as any}
                                                size={16}
                                                color={isSelected ? Colors.white : p.color}
                                            />
                                            <Text className={`ml-1.5 text-xs font-medium ${isSelected ? 'text-white' : 'text-text-tertiary'}`}>
                                                {p.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="text-text-secondary mb-2 font-medium text-xs uppercase tracking-wider">Reminder</Text>
                            {reminderDate ? (
                                <View>
                                    <ReminderItem
                                        reminder={{
                                            id: task?.fileUri || '',
                                            fileUri: task?.fileUri || '',
                                            fileName: title,
                                            title: title,
                                            reminderTime: properties[REMINDER_PROPERTY_KEY],
                                            recurrenceRule: properties[RECURRENT_PROPERTY_KEY],
                                            alarm: properties[ALARM_PROPERTY_KEY] === 'true',
                                            persistent: properties[PERSISTENT_PROPERTY_KEY] ? parseInt(properties[PERSISTENT_PROPERTY_KEY]) : undefined,
                                            content: ''
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
                                    className="bg-surface p-3 rounded-xl border border-border flex-row items-center justify-center border-dashed"
                                >
                                    <Ionicons name="alarm-outline" size={20} color={Colors.text.tertiary} />
                                    <Text className="text-text-tertiary ml-2 font-medium">Add Reminder</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="mb-4">
                            <PropertyEditor
                                label="Properties"
                                properties={(() => {
                                    const { event_id, ...rest } = properties;
                                    return rest;
                                })()}
                                onUpdate={(newProps) => setProperties(prev => ({ ...prev, ...newProps, event_id: prev.event_id }))}
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
                            className="flex-1 bg-surface p-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Cancel</Text>
                        </TouchableOpacity>

                        {onDelete && task && (task.fileUri || task.originalLine) && (
                            <TouchableOpacity
                                onPress={() => onDelete(task)}
                                className="bg-surface p-3 rounded-xl items-center justify-center border border-error"
                                style={{ width: 48 }}
                            >
                                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={handleSave}
                            className="flex-1 bg-primary p-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-semibold">Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <EventFormModal
                visible={showReminderModal}
                initialType={isAlarm ? 'alarm' : 'reminder'}
                initialDate={reminderDate || new Date()}
                initialEvent={reminderDate ? {
                    originalEvent: {
                        title: title,
                        recurrenceRule: properties[RECURRENT_PROPERTY_KEY],
                        alarm: isAlarm,
                        persistent: properties[PERSISTENT_PROPERTY_KEY] ? parseInt(properties[PERSISTENT_PROPERTY_KEY]) : undefined
                    },
                    title: title,
                    start: reminderDate,
                    reminderTime: reminderDate.toISOString()
                } : undefined}
                onSave={handleReminderSave}
                onCancel={() => setShowReminderModal(false)}
                timeFormat={timeFormat}
            />
        </Modal>
    );
}
