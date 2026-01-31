import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { Button } from '../ui/Button';
import { LinkAttachment } from '../ui/LinkAttachment';
import { FileAttachment } from '../ui/FileAttachment';
import { RichTextEditor } from '../RichTextEditor'; // Updated import
import { LongPressButton } from '../ui/LongPressButton';
import { URLMetadata } from '../../utils/urlMetadata';
import { useSettingsStore } from '../../store/settings';
import { SimpleTextEditor } from '../SimpleTextEditor';
import { ReminderItem } from '../ui/ReminderItem';

interface InputScreenProps {
    inputText: string;
    onInputTextChange: (text: string) => void;
    attachedFiles: { uri: string; name: string; size: number; mimeType: string }[];
    onRemoveFile: (index: number) => Promise<void>;
    suggestedTags: string[];
    selectedTags: string[];
    onToggleTag: (tag: string) => void;
    skipAnalyze: boolean;
    onToggleSkipAnalyze: () => void;
    openInObsidian: boolean;
    onToggleObsidian: () => void;
    onPreview: () => void;
    onQuickSave: () => void;
    onDirectSave: () => void;
    onCancel: () => void;
    onAttach: () => Promise<void>;
    onReminder?: () => void;
    onCamera: () => Promise<void>;
    onRecord: () => void;
    recording: boolean;
    disabled: boolean;
    onOpenSettings?: () => void;
    links?: URLMetadata[];
    onRemoveLink?: (index: number) => void;
    reminderData?: { date: Date; recurrence: string } | null;
    onRemoveReminder?: () => void;
}

export function InputScreen({
    inputText,
    onInputTextChange,
    attachedFiles,
    onRemoveFile,
    suggestedTags,
    selectedTags,
    onToggleTag,
    skipAnalyze,
    onToggleSkipAnalyze,
    openInObsidian,
    onToggleObsidian,
    onPreview,
    onQuickSave,
    onDirectSave,
    onCancel,
    onAttach,
    onReminder,
    onCamera,
    onRecord,
    recording,
    disabled,
    onOpenSettings,
    links,
    onRemoveLink,
    reminderData,
    onRemoveReminder,
}: InputScreenProps) {
    const { editorType, timeFormat } = useSettingsStore();
    return (
        <Layout>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Settings button header */}
                <View className="flex-row justify-between items-center px-4 pt-2 pb-1">
                    <Text className="text-2xl font-bold text-white">Take a Note</Text>
                </View>

                {/* Main Content ScrollView */}
                <ScrollView 
                    className="flex-1 px-4" 
                    contentContainerStyle={{ paddingBottom: 40 }} 
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Text Editor */}
                    {editorType === 'simple' ? (
                        <SimpleTextEditor
                            value={inputText}
                            onChangeText={onInputTextChange}
                            placeholder="Paste URL or type your thought..."
                            onAttach={onAttach}
                            onReminder={onReminder}
                            onCamera={onCamera}
                            onRecord={onRecord}
                            recording={recording}
                            disabled={disabled}
                            autoFocus
                        />
                    ) : (
                        <RichTextEditor
                            value={inputText}
                            onChangeText={onInputTextChange}
                            placeholder="Paste URL or type your thought..."
                            onAttach={onAttach}
                            onReminder={onReminder}
                            onCamera={onCamera}
                            onRecord={onRecord}
                            recording={recording}
                            disabled={disabled}
                            autoFocus
                        />
                    )}

                    {/* File attachment info */}
                    {attachedFiles.length > 0 && (
                        <View className="mb-4">
                            {attachedFiles.map((file, index) => (
                                <FileAttachment
                                    key={`${file.name}-${index}`}
                                    file={file}
                                    onRemove={() => onRemoveFile(index)}
                                    showRemove={true}
                                />
                            ))}
                        </View>
                    )}

                    {/* Link attachment info */}
                    {links && links.length > 0 && (
                         <View className="mb-4">
                            {links.map((link, index) => (
                                <LinkAttachment
                                    key={`${link.url}-${index}`}
                                    link={link}
                                    onRemove={onRemoveLink ? () => onRemoveLink(index) : undefined}
                                    showRemove={true}
                                />
                            ))}
                        </View>
                    )}

                    {/* Reminder Info */}
                    {reminderData && (
                        <View className="mb-4">
                            <ReminderItem 
                                reminder={{
                                    fileUri: '',
                                    fileName: 'Reminder',
                                    reminderTime: reminderData.date.toISOString(),
                                    recurrenceRule: reminderData.recurrence,
                                    content: 'Reminder set'
                                }}
                                timeFormat={timeFormat}
                                title="Reminder"
                                onDelete={onRemoveReminder}
                                showActions={true}
                            />
                        </View>
                    )}

                    {/* Suggested Tags Chips */}
                    {suggestedTags.length > 0 && (
                        <View className="flex-row flex-wrap gap-2 mb-4">
                            {suggestedTags.map(tag => {
                                const isSelected = selectedTags.includes(tag);
                                return (
                                    <TouchableOpacity
                                        key={tag}
                                        onPress={() => onToggleTag(tag)}
                                        className={`px-3 py-1.5 rounded-full border ${isSelected ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800/50 border-slate-700'}`}
                                    >
                                        <Text className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>#{tag}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Settings Toggles Row */}
                    <View className="flex-row items-center justify-between mb-4 px-1 gap-2">
                        {/* Skip Analyze Toggle */}
                        <View className="flex-1 flex-row items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <Text className="text-indigo-200 text-xs font-semibold mr-2">Skip AI</Text>
                            <TouchableOpacity
                                onPress={onToggleSkipAnalyze}
                                className={`w-10 h-6 rounded-full p-0.5 ${skipAnalyze ? 'bg-indigo-600' : 'bg-slate-600'}`}
                            >
                                <View className={`w-5 h-5 rounded-full bg-white ${skipAnalyze ? 'ml-auto' : ''}`} />
                            </TouchableOpacity>
                        </View>

                        {/* Open in Obsidian Toggle */}
                        <View className="flex-1 flex-row items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                            <Text className="text-indigo-200 text-xs font-semibold mr-2">Obsidian</Text>
                            <TouchableOpacity
                                onPress={onToggleObsidian}
                                className={`w-10 h-6 rounded-full p-0.5 ${openInObsidian ? 'bg-indigo-600' : 'bg-slate-600'}`}
                            >
                                <View className={`w-5 h-5 rounded-full bg-white ${openInObsidian ? 'ml-auto' : ''}`} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Buttons */}
                    {skipAnalyze ? (
                        <Button
                            title="Save directly"
                            onPress={onDirectSave}
                        />
                    ) : (
                        <LongPressButton
                            onPress={onPreview}
                            onLongPress={onQuickSave}
                            shortPressLabel="Preview"
                            longPressLabel="Quick Save"
                        />
                    )}
                    <View className="h-4" />
                    <Button
                        title="Cancel"
                        onPress={onCancel}
                        variant="secondary"
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Layout>
    );
}
