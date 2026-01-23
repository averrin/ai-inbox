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
import { TextEditor } from '../ui/TextEditor';
import { ProcessedNote } from '../../services/gemini';

import { LongPressButton } from '../ui/LongPressButton';
import { LinkAttachment } from '../ui/LinkAttachment';
import { ReminderItem } from '../ui/ReminderItem';
import { EventInfo } from '../ui/EventInfo';
import { ReminderEditModal } from '../ReminderEditModal';
import { URLMetadata } from '../../utils/urlMetadata';
import { useSettingsStore } from '../../store/settings';

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
    onAddTag: () => void;
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
    showTagModal: boolean;
    newTag: string;
    onNewTagChange: (text: string) => void;
    onTagModalClose: () => void;
    onTagModalConfirm: () => void;
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
    showTagModal,
    newTag,
    onNewTagChange,
    onTagModalClose,
    onTagModalConfirm,
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
    currentTabIndex = 0,
    totalTabs = 1,
    onTabChange,
}: PreviewScreenProps) {
    const { timeFormat } = useSettingsStore();


    // State for reminder editing
    const [isEditingReminder, setIsEditingReminder] = React.useState(false);
    const [editDate, setEditDate] = React.useState<Date>(new Date());
    const [editRecurrence, setEditRecurrence] = React.useState<string>('');

    
    // Focus Mode
    const [isFocused, setIsFocused] = React.useState(false);

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
            setIsEditingReminder(true);
        }
    };

    const handleSaveReminder = (date: Date, recurrence: string) => {
        if (onUpdateFrontmatter) {
            const updates: Record<string, any> = {
                reminder_datetime: date.toISOString()
            };
            if (recurrence) {
                updates.reminder_recurrent = recurrence;
            } else {
                updates.reminder_recurrent = recurrence; 
            }
            onUpdateFrontmatter(updates);
        }
        setIsEditingReminder(false);
    };

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
                {onOpenSettings && (
                    <TouchableOpacity onPress={onOpenSettings} className="p-2 bg-slate-800 rounded-full">
                        <Ionicons name="settings-sharp" size={20} color="white" />
                    </TouchableOpacity>
                )}
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
                                className={`px-4 py-2 rounded-full border ${
                                    currentTabIndex === index
                                        ? 'bg-indigo-600 border-indigo-500'
                                        : 'bg-slate-800 border-slate-700'
                                } mr-2`}
                            >
                                <Text
                                    className={`${
                                        currentTabIndex === index ? 'text-white font-bold' : 'text-slate-400'
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
                    <Card>
                        {data.icon && (
                            <View className="mb-4">
                                <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">Icon</Text>
                                <View className="flex-row items-center gap-2">
                                    <View className="flex-1">
                                        <TextInput
                                            value={data.icon}
                                            onChangeText={onIconChange}
                                            placeholder="Icon (emoji or Font Awesome)"
                                            placeholderTextColor="#94a3b8"
                                            className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white font-medium"
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={onRemoveIcon}
                                        className="bg-slate-700 px-3 py-3 rounded-xl"
                                    >
                                        <Ionicons name="close" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        <Input label="Title" value={title} onChangeText={onTitleChange} />
                        {/* Filename is auto-generated, hidden input */}
                        
                        <FolderInput
                            label="Folder"
                            value={folder}
                            onChangeText={onFolderChange}
                            vaultUri={vaultUri}
                            folderStatus={folderStatus}
                            onCheckFolder={onCheckFolder}
                            placeholder="e.g., Inbox/Notes"
                        />

                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Tags</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {tags.map((tag, index) => (
                                    <View key={index} className="bg-indigo-600/80 px-3 py-1.5 rounded-full flex-row items-center border border-indigo-500/50">
                                        <Text className="text-white mr-1 text-sm font-medium">{tag}</Text>
                                        <TouchableOpacity onPress={() => onRemoveTag(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {/* Add tag button */}
                                <TouchableOpacity
                                    onPress={onAddTag}
                                    className="bg-slate-700 px-3 py-1.5 rounded-full flex-row items-center border border-slate-600"
                                >
                                    <Ionicons name="add" size={16} color="white" />
                                    <Text className="text-white text-sm font-medium ml-1">Add Tag</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Metadata pills inline with tags */}
                            {data?.frontmatter && Object.keys(data.frontmatter).length > 0 && (
                                <View className="flex-row flex-wrap gap-2 mt-2">
                                    {Object.entries(data.frontmatter).map(([key, value]) => (
                                        <View key={key} className="bg-slate-700/80 px-3 py-1.5 rounded-full flex-row items-center border border-slate-600/50">
                                            <Text className="text-slate-400 text-xs mr-1">{key}:</Text>
                                            <Text className="text-slate-200 text-xs mr-2">{typeof value === 'string' ? value : JSON.stringify(value)}</Text>
                                            <TouchableOpacity
                                                onPress={() => onRemoveFrontmatterKey(key)}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Ionicons name="close" size={14} color="#94a3b8" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
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
                    
                            {/* Pending Reminders */}
                            {data?.frontmatter?.reminder_datetime && (
                                <View className="mb-4">
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
                                <View className="mb-4">
                                    <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Pending Events (Calendar)</Text>
                                    {data.actions.map((action, index) => (
                                        <EventInfo 
                                            key={`action-${index}`}
                                            action={action}
                                            onRemove={() => onRemoveAction && onRemoveAction(index)}
                                            showRemove={!!onRemoveAction}
                                        />
                                    ))}
                                </View>
                            )}
                        </>
                    )}

                    {/* Body Content */}
                    <View className={`mb-4 ${isFocused ? 'flex-1 mt-4' : ''}`}>
                        {!isFocused && <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Content</Text>}
                        <TextEditor
                            value={body}
                            onChangeText={onBodyChange}
                            placeholder="Note content..."
                            onAttach={onAttach}
                            onCamera={onCamera}
                            onRecord={onRecord}
                            recording={recording}
                            disabled={saving}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => { /* Wait for user to explicitly exit focus mode via back button */ }}
                            containerStyle={isFocused ? { flex: 1, marginBottom: 0 } : undefined}
                            inputStyle={isFocused ? { maxHeight: undefined, height: '100%' } : undefined}
                        />
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

            {/* Tag Input Modal */}
            <Modal visible={showTagModal} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-slate-900 rounded-3xl p-6 w-[85%] max-w-md">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Add Tag</Text>
                            <TouchableOpacity onPress={onTagModalClose}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row gap-2">
                            <View className="flex-1">
                                <TextInput
                                    value={newTag}
                                    onChangeText={onNewTagChange}
                                    placeholder="Enter tag name..."
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-medium"
                                    onSubmitEditing={onTagModalConfirm}
                                    returnKeyType="done"
                                    autoFocus
                                />
                            </View>
                            <TouchableOpacity
                                onPress={onTagModalConfirm}
                                className="px-6 py-4 rounded-xl bg-indigo-600"
                            >
                                <Text className="text-white font-semibold">Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <ReminderEditModal
                visible={isEditingReminder}
                initialDate={editDate}
                initialRecurrence={editRecurrence}
                onSave={handleSaveReminder}
                onCancel={() => setIsEditingReminder(false)}
                timeFormat={timeFormat}
            />
        </Layout>
    );
}
