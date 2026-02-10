import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FolderInput } from '../ui/FolderInput';
import { FileAttachment } from '../ui/FileAttachment';
import { ProseMarkEditor } from '../ui/ProseMarkEditor';
import { SimpleTextEditor } from '../SimpleTextEditor';
import { TagEditor } from '../ui/TagEditor';
import { PropertyEditor } from '../ui/PropertyEditor';
import { ProcessedNote } from '../../services/gemini';

import { LongPressButton } from '../ui/LongPressButton';
import { LinkAttachment } from '../ui/LinkAttachment';
import { ReminderItem } from '../ui/ReminderItem';
import { EventInfo } from '../ui/EventInfo';
import { EventFormModal, EventSaveData } from '../EventFormModal';
import { EventEditModal } from '../EventEditModal';
import { TimeSyncPanel } from '../ui/TimeSyncPanel';
import { Action } from '../../services/gemini';
import { URLMetadata } from '../../utils/urlMetadata';
import { useSettingsStore } from '../../store/settings';
import { useVaultStore } from '../../services/vaultService';
import { getPropertyKeysFromCache } from '../../utils/propertyUtils';
import { RichTaskItem } from '../markdown/RichTaskItem';
import { TaskEditModal } from '../markdown/TaskEditModal';
import { findTasks, updateTaskInText, RichTask, removeTaskFromText } from '../../utils/taskParser';

interface PreviewScreenProps {
    data: ProcessedNote;
    title: string;
    onTitleChange: (text: string) => void;
    filename: string;
    onFilenameChange: (text: string) => void;
    folder: string;
    onFolderChange: (text: string) => void;
    folderStatus: 'neutral' | 'valid' | 'invalid';
    onCheckFolder: () => void;
    tags: string[];
    onRemoveTag: (index: number) => void;
    onAddTag: (tag: string) => void;
    body: string;
    onBodyChange: (text: string) => void;
    attachedFiles: { uri: string; name: string; size: number; mimeType: string }[];
    onRemoveAttachment: (index: number) => Promise<void>;
    onSave: () => void;
    onSaveAndAddNew: () => void;
    onBack: () => void;
    saving: boolean;
    vaultUri: string | null;
    onOpenSettings?: () => void;
    onRemoveIcon: () => void;
    onIconChange: (text: string) => void;
    onRemoveFrontmatterKey: (key: string) => void;
    onAttach: () => Promise<void>;
    onCamera: () => Promise<void>;
    onRecord: () => void;
    recording: boolean;
    links?: URLMetadata[];
    onRemoveLink?: (index: number) => void;
    onRemoveAction?: (index: number) => void;
    onUpdateAction?: (index: number, action: Action) => void;
    onUpdateFrontmatter?: (updates: Record<string, any>) => void;

    // Tab props
    currentTabIndex?: number;
    totalTabs?: number;
    onTabChange?: (index: number) => void;
}

export function PreviewScreen({
    data,
    title,
    onTitleChange,
    filename,
    onFilenameChange,
    folder,
    onFolderChange,
    folderStatus,
    onCheckFolder,
    tags,
    onRemoveTag,
    onAddTag,
    body,
    onBodyChange,
    attachedFiles,
    onRemoveAttachment,
    onSave,
    onSaveAndAddNew,
    onBack,
    saving,
    vaultUri,
    onOpenSettings,
    onRemoveIcon,
    onIconChange,
    onRemoveFrontmatterKey,
    onUpdateFrontmatter,
    onAttach,
    onCamera,
    onRecord,
    recording,
    links,
    onRemoveLink,
    onRemoveAction,
    onUpdateAction,
    currentTabIndex = 0,
    totalTabs = 1,
    onTabChange,
}: PreviewScreenProps) {
    const { timeFormat, editorType } = useSettingsStore();
    const { metadataCache } = useVaultStore();


    // State for reminder editing
    const [isEditingReminder, setIsEditingReminder] = React.useState(false);
    const [editDate, setEditDate] = React.useState<Date>(new Date());
    const [editRecurrence, setEditRecurrence] = React.useState<string>('');
    const [editAlarm, setEditAlarm] = React.useState<boolean>(false);
    const [editPersistent, setEditPersistent] = React.useState<number | undefined>(undefined);


    // Focus Mode
    const [isFocused, setIsFocused] = React.useState(false);

    // Time Sync State
    const [isTimeSynced, setIsTimeSynced] = React.useState(false);

    const handleCopyReminderToEvents = () => {
        if (!data?.frontmatter?.reminder_datetime || !data?.actions || !onUpdateAction) return;

        data.actions.forEach((action, index) => {
            const updatedAction = { ...action, startTime: data.frontmatter.reminder_datetime };
            onUpdateAction(index, updatedAction);
        });
    };

    const handleCopyEventsToReminder = () => {
        if (!data?.actions || data.actions.length === 0 || !onUpdateFrontmatter) return;

        // Use first event's time
        const firstEventTime = data.actions[0].startTime;
        if (firstEventTime) {
            onUpdateFrontmatter({ reminder_datetime: firstEventTime });
        }
    };

    const handleToggleSync = (value: boolean) => {
        setIsTimeSynced(value);
        if (value) {
            handleCopyReminderToEvents();
        }
    };

    // Auto-update filename from title
    React.useEffect(() => {
        if (!title) return;
        const sanitized = title.replace(/[^a-zA-Z0-9-_]/g, '-');
        onFilenameChange(`${sanitized}.md`);
    }, [title]);

    const handleEditReminder = () => {
        if (data?.frontmatter?.reminder_datetime) {
            setEditDate(new Date(data.frontmatter.reminder_datetime));
            setEditRecurrence(data.frontmatter.reminder_recurrent || '');
            setEditAlarm(data.frontmatter.reminder_alarm === 'true');
            const p = data.frontmatter.reminder_persistent;
            setEditPersistent(p ? parseInt(p, 10) : undefined);
            setIsEditingReminder(true);
        }
    };

    const handleCreateReminder = () => {
        setEditDate(new Date());
        setEditRecurrence('');
        setEditAlarm(false);
        setEditPersistent(undefined);
        setIsEditingReminder(true);
    };

    const formatRecurrenceForReminder = (rule: any): string | undefined => {
      if (!rule || !rule.frequency || rule.frequency === 'none') return undefined;
      const freq = rule.frequency.toLowerCase();
      const interval = rule.interval || 1;

      if (interval === 1) {
          return freq; // 'daily', 'weekly', etc.
      }

      let unit = '';
      if (freq === 'daily') unit = 'days';
      else if (freq === 'weekly') unit = 'weeks';
      else if (freq === 'monthly') unit = 'months';
      else if (freq === 'yearly') unit = 'years';

      if (unit) return `${interval} ${unit}`;
      return undefined;
    };

    const handleSaveReminder = (eventData: EventSaveData) => {
        const isoDate = eventData.startDate.toISOString();
        const recurrence = formatRecurrenceForReminder(eventData.recurrenceRule) || '';
        const alarm = eventData.alarm;
        const persistent = eventData.persistent;

        if (onUpdateFrontmatter) {
            const updates: Record<string, any> = {
                reminder_datetime: isoDate
            };

            if (recurrence) updates.reminder_recurrent = recurrence;
            else updates.reminder_recurrent = undefined;

            updates.reminder_alarm = alarm ? 'true' : undefined;
            if (!alarm) updates.reminder_alarm = undefined;

            updates.reminder_persistent = persistent !== undefined ? persistent.toString() : undefined;

            onUpdateFrontmatter(updates);
        }

        // Sync to events if enabled
        if (isTimeSynced && data?.actions && onUpdateAction) {
            data.actions.forEach((action, index) => {
                const updatedAction = { ...action, startTime: isoDate };
                onUpdateAction(index, updatedAction);
            });
        }
        setIsEditingReminder(false);
    };

    // Event Editing State
    const [editingEventIndex, setEditingEventIndex] = React.useState<number | null>(null);
    const [showEventModal, setShowEventModal] = React.useState(false);

    const handleEditEvent = (index: number) => {
        setEditingEventIndex(index);
        setShowEventModal(true);
    };

    const handleSaveEvent = (updatedAction: Action) => {
        if (editingEventIndex !== null && onUpdateAction) {
            onUpdateAction(editingEventIndex, updatedAction);

            // Sync to reminder (and other events??) if enabled
            // "Updated Action" is the new source of truth
            if (isTimeSynced && updatedAction.startTime && onUpdateFrontmatter) {
                onUpdateFrontmatter({ reminder_datetime: updatedAction.startTime });

                // Also sync other events? 
                // If we have multiple events, "Time Sync" implies they all move together if synced?
                // Let's keep it simple: Reminder <-> All Events
                if (data?.actions) {
                    data.actions.forEach((otherAction, otherIndex) => {
                        if (otherIndex !== editingEventIndex) {
                            onUpdateAction(otherIndex, { ...otherAction, startTime: updatedAction.startTime });
                        }
                    });
                }
            }
        }
        setShowEventModal(false);
        setEditingEventIndex(null);
    };

    // Rich Task State
    const [editingTask, setEditingTask] = React.useState<RichTask | null>(null);
    const [isTaskModalVisible, setIsTaskModalVisible] = React.useState(false);

    const tasks = React.useMemo(() => findTasks(body), [body]);

    const handleToggleTask = (task: RichTask) => {
        const updatedTask = { ...task, completed: !task.completed };
        const newText = updateTaskInText(body, task, updatedTask);
        onBodyChange(newText);
    };

    const handleEditTask = (task: RichTask) => {
        setEditingTask(task);
        setIsTaskModalVisible(true);
    };

    const handleDeleteTask = (task: RichTask) => {
        const newText = removeTaskFromText(body, task);
        onBodyChange(newText);
    };

    const handleSaveTask = (updatedTask: RichTask) => {
        if (editingTask) {
            const newText = updateTaskInText(body, editingTask, updatedTask);
            onBodyChange(newText);
        }
        setIsTaskModalVisible(false);
        setEditingTask(null);
    };

    const handleUpdateTask = (originalTask: RichTask, updatedTask: RichTask) => {
        const newText = updateTaskInText(body, originalTask, updatedTask);
        onBodyChange(newText);
    };

    // Mock event for EventFormModal
    const mockReminderEvent = isEditingReminder ? {
        typeTag: 'REMINDER',
        originalEvent: {
            title: title || 'Reminder',
            fileUri: 'preview', // dummy
            alarm: editAlarm,
            persistent: editPersistent,
            recurrenceRule: editRecurrence
        },
        title: title || 'Reminder',
        start: editDate,
        end: editDate,
        reminderTime: editDate.toISOString()
    } : null;

    return (
        <Layout>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
                keyboardVerticalOffset={0}
            >
                {/* Settings button header - Hidden in focus mode */}
                {!isFocused && (
                    <View className="flex-row justify-between items-center px-4 pt-2 pb-1 relative">
                        <View className="flex-row items-center gap-3">
                            <TouchableOpacity onPress={onBack} className="p-2">
                                <Ionicons name="arrow-back" size={24} color="white" />
                            </TouchableOpacity>
                            <Text className="text-2xl font-bold text-white">Preview</Text>
                        </View>
                    </View>
                )}

                {/* Tabs - Hidden in focus mode */}
                {totalTabs > 1 && !isFocused && (
                    <View className="px-4 pb-2">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                            {Array.from({ length: totalTabs }).map((_, index) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => onTabChange?.(index)}
                                    className={`px-4 py-2 rounded-full border ${currentTabIndex === index
                                        ? 'bg-indigo-600 border-indigo-500'
                                        : 'bg-slate-800 border-slate-700'
                                        } mr-2`}
                                >
                                    <Text
                                        className={`${currentTabIndex === index ? 'text-white font-bold' : 'text-slate-400'
                                            }`}
                                    >
                                        Note {index + 1}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <Animated.View entering={FadeIn.duration(500)} style={{ flex: 1 }}>
                        {!isFocused && (
                            <Card padding="p-3">
                                {/* Header Row: Icon (if exists), Title */}
                                <View className="flex-row items-center gap-2 mb-2">
                                    {/* Icon Input: 1/3 width */}
                                    <View className="flex-[1] relative">
                                        {data.icon ? (
                                            <View>
                                                <TextInput
                                                    value={data.icon}
                                                    onChangeText={onIconChange}
                                                    placeholder="Mood"
                                                    placeholderTextColor="#94a3b8"
                                                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white font-medium text-center]"
                                                />
                                                <TouchableOpacity
                                                    onPress={onRemoveIcon}
                                                    className="absolute -top-1 -right-1 bg-slate-700 rounded-full p-1 border border-slate-600 shadow-sm z-10"
                                                >
                                                    <Ionicons name="close" size={10} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={() => onIconChange('📝')}
                                                className="bg-slate-800/50 border border-slate-700 rounded-xl p-3  justify-center items-center"
                                            >
                                                <Ionicons name="happy-outline" size={20} color="#94a3b8" />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    {/* Title Input: 2/3 width */}
                                    <View className="flex-[2]">
                                        <TextInput
                                            value={title}
                                            onChangeText={onTitleChange}
                                            className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white font-medium text-base]"
                                            placeholder="Note Title"
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>
                                </View>

                                {/* Folder Input - Always Visible */}
                                <FolderInput
                                    label="Folder"
                                    value={folder}
                                    onChangeText={onFolderChange}
                                    vaultUri={vaultUri}
                                    folderStatus={folderStatus}
                                    onCheckFolder={onCheckFolder}
                                    placeholder="e.g., Inbox/Notes"
                                    compact={true}
                                />

                                {/* Tags - Always Visible */}
                                <TagEditor
                                    tags={tags}
                                    onAddTag={onAddTag}
                                    onRemoveTag={onRemoveTag}
                                />

                                {/* Collapsible Metadata (Frontmatter) */}
                                <PropertyEditor
                                    label="Properties"
                                    properties={(() => {
                                        const props = { ...data.frontmatter };
                                        delete props.tags;
                                        delete props.icon;
                                        return props;
                                    })()}
                                    onUpdate={(newProps) => {
                                        if (!onUpdateFrontmatter) return;
                                        
                                        const updates: Record<string, any> = {};
                                        // We need to compare with the subset of properties we are editing
                                        const currentProps = { ...data.frontmatter };
                                        delete currentProps.tags;
                                        delete currentProps.icon;

                                        // 1. Check for modified or added properties
                                        Object.keys(newProps).forEach(key => {
                                            if (newProps[key] !== currentProps[key]) {
                                                updates[key] = newProps[key];
                                            }
                                        });

                                        // 2. Check for removed properties
                                        Object.keys(currentProps).forEach(key => {
                                            if (!(key in newProps)) {
                                                updates[key] = undefined;
                                            }
                                        });
                                        
                                        if (Object.keys(updates).length > 0) {
                                            onUpdateFrontmatter(updates);
                                        }
                                    }}
                                    metadataCache={metadataCache}
                                />
                            </Card>
                        )}

                        {/* File/Link attachments - hidden in focus mode */}
                        {!isFocused && (
                            <>
                                {/* File attachment info in preview */}
                                {attachedFiles.length > 0 && (
                                    <View className="mb-2">
                                        {attachedFiles.map((file, index) => (
                                            <FileAttachment
                                                key={`preview-${file.name}-${index}`}
                                                file={file}
                                                showRemove={true}
                                                onRemove={() => onRemoveAttachment(index)}
                                            />
                                        ))}
                                    </View>
                                )}

                                {/* Link attachment info in preview */}
                                {links && links.length > 0 && (
                                    <View className="mb-2">
                                        {links.map((link, index) => (
                                            <LinkAttachment
                                                key={`preview-link-${link.url}-${index}`}
                                                link={link}
                                                showRemove={true}
                                                onRemove={onRemoveLink ? () => onRemoveLink(index) : undefined}
                                            />
                                        ))}
                                     </View>
                                )}

                                {/* Rich Task Items */}
                                {tasks.length > 0 && (
                                    <View className="mb-2">
                                        <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Tasks</Text>
                                        {tasks.map((task, index) => (
                                            <View key={`${task.title}-${index}`} className="mb-1">
                                                <RichTaskItem
                                                    task={task}
                                                    onToggle={() => handleToggleTask(task)}
                                                    onEdit={() => handleEditTask(task)}
                                                    onDelete={() => handleDeleteTask(task)}
                                                    onUpdate={(updated) => handleUpdateTask(task, updated)}
                                                />
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Pending Reminders */}
                                {data?.frontmatter?.reminder_datetime && (
                                    <View className="mb-2">
                                        <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Reminder</Text>
                                        <ReminderItem
                                            reminder={{
                                                fileUri: '',
                                                fileName: 'New Reminder',
                                                reminderTime: data.frontmatter.reminder_datetime,
                                                recurrenceRule: data.frontmatter.reminder_recurrent,

                                                content: 'This note will trigger a notification'
                                            }}
                                            timeFormat={timeFormat}
                                            title={title || 'New Reminder'}
                                            onEdit={handleEditReminder}
                                            onDelete={() => onRemoveFrontmatterKey('reminder_datetime')}
                                            showActions={true}
                                        />
                                    </View>
                                )}

                                {/* Pending Actions (Google Calendar) */}
                                {data.actions && data.actions.length > 0 && (
                                    <View className="mb-2">
                                        {/* Conditionally Render Header or Sync Panel */}
                                        {data?.frontmatter?.reminder_datetime ? (
                                            <TimeSyncPanel
                                                isSynced={isTimeSynced}
                                                onToggleSync={handleToggleSync}
                                                onCopyReminderToEvents={handleCopyReminderToEvents}
                                                onCopyEventsToReminder={handleCopyEventsToReminder}
                                            />
                                        ) : (
                                            <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Pending Events (Calendar)</Text>
                                        )}

                                        <View className="flex-col gap-2">
                                            {data.actions.map((action, index) => (
                                                <EventInfo
                                                    key={`action-${index}`}
                                                    action={action}
                                                    onRemove={() => onRemoveAction && onRemoveAction(index)}
                                                    showRemove={!!onRemoveAction}
                                                    onEdit={() => handleEditEvent(index)}
                                                    timeFormat={timeFormat}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </>
                        )}

                        {/* Body Content */}
                        <View className={`mb-4 ${isFocused ? 'flex-1 mt-4' : ''}`}>
                            {!isFocused && <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Content</Text>}
                            {editorType === 'simple' ? (
                                <SimpleTextEditor
                                    value={body}
                                    onChangeText={onBodyChange}
                                    placeholder="Note content..."
                                    onAttach={onAttach}
                                    onReminder={handleCreateReminder}
                                    onCamera={onCamera}
                                    onRecord={onRecord}
                                    recording={recording}
                                    disabled={saving}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => { /* Wait for user to explicitly exit focus mode via back button */ }}
                                    containerStyle={isFocused ? { flex: 1, marginBottom: 0 } : undefined}
                                    inputStyle={isFocused ? { maxHeight: undefined, height: '100%' } : undefined}
                                />
                            ) : (
                                <ProseMarkEditor
                                    value={body}
                                    onChangeText={onBodyChange}
                                    placeholder="Note content..."
                                    onAttach={onAttach}
                                    onReminder={handleCreateReminder}
                                    onCamera={onCamera}
                                    onRecord={onRecord}
                                    recording={recording}
                                    disabled={saving}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => { /* Wait for user to explicitly exit focus mode via back button */ }}
                                    containerStyle={isFocused ? { flex: 1, marginBottom: 0 } : undefined}
                                    inputStyle={isFocused ? { maxHeight: undefined, height: '100%' } : undefined}
                                />
                            )}
                        </View>

                    </Animated.View>
                </ScrollView>


                {/* Floating Action Buttons - absolute within the shrinking KAV */}
                <View
                    className="absolute bottom-4 w-full flex-row justify-between px-6 px-[24px]"
                    pointerEvents="box-none"
                >
                    {isFocused ? (
                        <TouchableOpacity
                            onPress={() => {
                                setIsFocused(false);
                                Keyboard.dismiss();
                            }}
                            className="w-14 h-14 rounded-full bg-slate-700 items-center justify-center shadow-lg"
                            style={{ elevation: 8 }}
                        >
                            <Ionicons name="arrow-back" size={28} color="white" />
                        </TouchableOpacity>
                    ) : (
                        <View /> /* Spacer if no back button to keep save on right? No, standard layout relies on positioning. */
                    )}

                    {/* Save button - always visible or at least in focus mode too */}
                    <LongPressButton
                        onPress={onSave}
                        onLongPress={onSaveAndAddNew}
                        shortPressLabel="Save"
                        longPressLabel="Save & Add New"
                        disabled={saving || !vaultUri}
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: 28,
                            backgroundColor: '#6366f1', // indigo-500
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 4.65,
                            elevation: 8,
                            overflow: 'hidden',
                            marginLeft: 'auto' // Push to right
                        }}
                    >
                        <Ionicons name="checkmark" size={32} color="white" />
                    </LongPressButton>
                </View>
            </KeyboardAvoidingView>

            <EventFormModal
                visible={isEditingReminder}
                initialEvent={mockReminderEvent}
                initialType={editAlarm ? 'alarm' : 'reminder'}
                initialDate={editDate}
                onSave={handleSaveReminder}
                onCancel={() => setIsEditingReminder(false)}
                timeFormat={timeFormat}
            />

            <EventEditModal
                visible={showEventModal}
                initialEvent={(editingEventIndex !== null && data?.actions) ? data.actions[editingEventIndex] : null}
                onSave={handleSaveEvent}
                 onCancel={() => {
                    setShowEventModal(false);
                    setEditingEventIndex(null);
                }}
                timeFormat={timeFormat}
            />

            <TaskEditModal
                visible={isTaskModalVisible}
                task={editingTask}
                onSave={handleSaveTask}
                onCancel={() => setIsTaskModalVisible(false)}
            />
        </Layout>
    );
}
