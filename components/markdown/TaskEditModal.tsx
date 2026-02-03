import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RichTask } from '../../utils/taskParser';
import { TagEditor } from '../ui/TagEditor';
import { PropertyEditor } from '../ui/PropertyEditor';
import { useVaultStore } from '../../services/vaultService';
import { getPropertyKeysFromCache } from '../../utils/propertyUtils';

interface TaskEditModalProps {
    visible: boolean;
    task: RichTask | null;
    onSave: (updatedTask: RichTask) => void;
    onCancel: () => void;
}

export function TaskEditModal({ visible, task, onSave, onCancel }: TaskEditModalProps) {
    const [title, setTitle] = useState('');
    const [status, setStatus] = useState(' ');
    const [properties, setProperties] = useState<Record<string, any>>({});
    const [tags, setTags] = useState<string[]>([]);

    const vaultCache = useVaultStore(state => state.metadataCache);
    const keySuggestions = useMemo(() => getPropertyKeysFromCache(vaultCache), [vaultCache]);

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setStatus(task.status);
            setProperties(task.properties);
            setTags(task.tags);
        }
    }, [task]);

    const handleSave = () => {
        if (!task) return;
        const updatedTask: RichTask = {
            ...task,
            title,
            status,
            completed: status === 'x',
            properties,
            tags,
        };
        onSave(updatedTask);
    };

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
                            <Text className="text-indigo-200 mb-2 font-medium text-xs uppercase tracking-wider">Status</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {[
                                    { id: ' ', icon: 'square-outline', label: 'Pending', color: '#94a3b8' },
                                    { id: '/', icon: 'play-circle-outline', label: 'Doing', color: '#818cf8' },
                                    { id: 'x', icon: 'checkbox', label: 'Done', color: '#6366f1' },
                                    { id: '-', icon: 'close-circle-outline', label: 'Won\'t Do', color: '#94a3b8' },
                                    { id: '?', icon: 'help-circle-outline', label: 'Planned', color: '#fbbf24' },
                                    { id: '>', icon: 'arrow-forward-circle-outline', label: 'Delayed', color: '#6366f1' },
                                ].map((s) => (
                                    <TouchableOpacity
                                        key={s.id}
                                        onPress={() => setStatus(s.id)}
                                        className={`flex-row items-center px-3 py-2 rounded-xl border ${status === s.id ? 'bg-indigo-600/20 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
                                    >
                                        <Ionicons 
                                            name={s.icon as any} 
                                            size={16} 
                                            color={status === s.id ? '#818cf8' : s.color} 
                                        />
                                        <Text className={`ml-2 text-xs font-medium ${status === s.id ? 'text-indigo-300' : 'text-slate-400'}`}>
                                            {s.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View className="mb-4">
                            <PropertyEditor
                                label="Properties"
                                properties={properties}
                                onUpdate={setProperties}
                                keySuggestions={keySuggestions}
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
        </Modal>
    );
}
