import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Layout } from '../ui/Layout';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { FolderInput } from '../ui/FolderInput';
import { FileAttachment } from '../ui/FileAttachment';
import { TextEditor } from '../ui/TextEditor';
import { ProcessedNote } from '../../services/gemini';

import { LongPressButton } from '../ui/LongPressButton';

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
    onAttach,
    onCamera,
    onRecord,
    recording,
}: PreviewScreenProps) {
    return (
        <Layout>
            {/* Settings button header */}
            <View className="flex-row justify-between items-center px-4 pt-2 pb-1">
                <Text className="text-2xl font-bold text-white">Preview</Text>
                {onOpenSettings && (
                    <TouchableOpacity onPress={onOpenSettings} className="p-2 bg-slate-800 rounded-full">
                        <Text className="text-xl">⚙️</Text>
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeIn.duration(500)}>
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
                                        <Text className="text-white font-semibold">✕</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        <Input label="Title" value={title} onChangeText={onTitleChange} />
                        <Input label="Filename" value={filename} onChangeText={onFilenameChange} />
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
                                        <Text className="text-white mr-2 text-sm font-medium">{tag}</Text>
                                        <TouchableOpacity onPress={() => onRemoveTag(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Text className="text-white/70 font-bold ml-1">×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {/* Add tag button */}
                                <TouchableOpacity
                                    onPress={onAddTag}
                                    className="bg-slate-700 px-3 py-1.5 rounded-full flex-row items-center border border-slate-600"
                                >
                                    <Text className="text-white text-sm font-medium">+ Add Tag</Text>
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
                                                <Text className="text-slate-400 font-bold ml-1">×</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </Card>

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

                    {/* Body Content */}
                    <View className="mb-4">
                        <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Content</Text>
                        <TextEditor
                            value={body}
                            onChangeText={onBodyChange}
                            placeholder="Note content..."
                            onAttach={onAttach}
                            onCamera={onCamera}
                            onRecord={onRecord}
                            recording={recording}
                            disabled={saving}
                        />
                    </View>

                    <View className="py-4">
                        <LongPressButton
                            onPress={onSave}
                            onLongPress={onSaveAndAddNew}
                            shortPressLabel="Save to Vault"
                            longPressLabel="Save & Add New"
                            disabled={saving || !vaultUri}
                        />
                        <View className="h-4" />
                        <Button
                            title="Back"
                            onPress={onBack}
                            variant="secondary"
                        />
                    </View>
                </Animated.View>
            </ScrollView>

            {/* Tag Input Modal */}
            <Modal visible={showTagModal} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-slate-900 rounded-3xl p-6 w-[85%] max-w-md">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Add Tag</Text>
                            <TouchableOpacity onPress={onTagModalClose}>
                                <Text className="text-white text-2xl">✕</Text>
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
        </Layout>
    );
}
