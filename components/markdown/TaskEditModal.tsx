import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RichTask } from '../../utils/taskParser';
import { TagEditor } from '../ui/TagEditor';

interface TaskEditModalProps {
    visible: boolean;
    task: RichTask | null;
    onSave: (updatedTask: RichTask) => void;
    onCancel: () => void;
}

export function TaskEditModal({ visible, task, onSave, onCancel }: TaskEditModalProps) {
    const [title, setTitle] = useState('');
    const [properties, setProperties] = useState<[string, string][]>([]);
    const [tags, setTags] = useState<string[]>([]);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setProperties(Object.entries(task.properties));
            setTags(task.tags);
        }
    }, [task]);

    const handleSave = () => {
        if (!task) return;
        const updatedTask: RichTask = {
            ...task,
            title,
            properties: Object.fromEntries(properties),
            tags,
        };
        onSave(updatedTask);
    };

    const addProperty = () => setProperties([...properties, ['', '']]);
    const updateProperty = (index: number, key: string, value: string) => {
        const newProps = [...properties];
        newProps[index] = [key, value];
        setProperties(newProps);
    };
    const removeProperty = (index: number) => setProperties(properties.filter((_, i) => i !== index));

    const handleRemoveTag = (index: number) => setTags(tags.filter((_, i) => i !== index));
    const handleAddTag = (tag: string) => {
        if (!tags.includes(tag)) {
            setTags([...tags, tag]);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-center items-center bg-black/50 px-4"
            >
                <View className="bg-slate-900 w-full max-w-md p-6 rounded-3xl border border-slate-700 max-h-[80%]">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-xl font-bold">Edit Task</Text>
                        <TouchableOpacity onPress={onCancel}>
                            <Ionicons name="close" size={24} color="#94a3b8" />
                        </TouchableOpacity>
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
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-indigo-200 font-medium text-xs uppercase tracking-wider">Properties</Text>
                                <TouchableOpacity onPress={addProperty} className="bg-indigo-600/20 px-2 py-1 rounded">
                                    <Text className="text-indigo-400 text-[10px] font-bold">+ ADD</Text>
                                </TouchableOpacity>
                            </View>
                            {properties.map(([key, value], index) => (
                                <View key={index} className="flex-row gap-2 mb-2">
                                    <TextInput
                                        className="flex-1 bg-slate-800 text-white p-2 rounded-lg border border-slate-700 text-sm"
                                        value={key}
                                        onChangeText={(v) => updateProperty(index, v, value)}
                                        placeholder="Key"
                                        placeholderTextColor="#64748b"
                                    />
                                    <TextInput
                                        className="flex-2 bg-slate-800 text-white p-2 rounded-lg border border-slate-700 text-sm"
                                        value={value}
                                        onChangeText={(v) => updateProperty(index, key, v)}
                                        placeholder="Value"
                                        placeholderTextColor="#64748b"
                                    />
                                    <TouchableOpacity onPress={() => removeProperty(index)} className="justify-center">
                                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
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
        </Modal>
    );
}
