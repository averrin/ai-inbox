import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVaultStore } from '../../services/vaultService';
import { getTagsFromCache } from '../../utils/tagUtils';

interface TagEditorProps {
    tags: string[];
    onAddTag: (tag: string) => void;
    onRemoveTag: (index: number) => void;
    label?: string;
}

export function TagEditor({ tags, onAddTag, onRemoveTag, label }: TagEditorProps) {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const vaultCache = useVaultStore((state) => state.metadataCache);
    const allTags = useMemo(() => getTagsFromCache(vaultCache), [vaultCache]);
    
    const suggestions = useMemo(() => {
        return allTags
            .filter(t => !tags.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase()))
            .slice(0, 10);
    }, [allTags, tags, inputValue]);

    const handleConfirm = () => {
        const trimmed = inputValue.trim();
        if (trimmed) {
            onAddTag(trimmed);
            setInputValue('');
            setIsModalVisible(false);
        }
    };

    const handleClose = () => {
        setIsModalVisible(false);
        setInputValue('');
    };

    return (
        <View className="mt-2 mb-1">
            {label && (
                <Text className="text-indigo-200 mb-2 font-medium text-xs uppercase tracking-wider">{label}</Text>
            )}
            
            <View className="flex-row flex-wrap gap-2">
                {tags.map((tag, index) => (
                    <View key={`${tag}-${index}`} className="bg-indigo-600/80 px-2.5 py-1 rounded-md flex-row items-center border border-indigo-500/50">
                        <Text className="text-white mr-1 text-xs font-medium">{tag}</Text>
                        <TouchableOpacity 
                            onPress={() => onRemoveTag(index)} 
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="close" size={10} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                    </View>
                ))}
                
                <TouchableOpacity
                    onPress={() => setIsModalVisible(true)}
                    className="bg-slate-700 px-2.5 py-1 rounded-md flex-row items-center border border-slate-600"
                >
                    <Ionicons name="add" size={12} color="white" />
                    <Text className="text-white text-xs font-medium ml-1">Tag</Text>
                </TouchableOpacity>
            </View>

            {/* Tag Input Modal */}
            <Modal visible={isModalVisible} transparent animationType="fade" onRequestClose={handleClose}>
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-slate-900 rounded-3xl p-6 w-[85%] max-w-md border border-slate-700">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Add Tag</Text>
                            <TouchableOpacity onPress={handleClose}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        
                        <View className="flex-row gap-2 mb-2">
                            <View className="flex-1">
                                <TextInput
                                    value={inputValue}
                                    onChangeText={setInputValue}
                                    placeholder="Enter tag name..."
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-medium"
                                    onSubmitEditing={handleConfirm}
                                    returnKeyType="done"
                                    autoFocus
                                    autoCapitalize="none"
                                />
                            </View>
                            <TouchableOpacity
                                onPress={handleConfirm}
                                className="px-6 py-4 rounded-xl bg-indigo-600 justify-center"
                            >
                                <Text className="text-white font-semibold">Add</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Tag Suggestions */}
                        {suggestions.length > 0 && (
                            <View className="mt-2 max-h-40">
                                <Text className="text-slate-400 text-xs font-bold mb-2 uppercase">Suggestions</Text>
                                <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                                    <View className="flex-row flex-wrap gap-2">
                                        {suggestions.map(tag => (
                                            <TouchableOpacity
                                                key={tag}
                                                onPress={() => setInputValue(tag)}
                                                className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg"
                                            >
                                                <Text className="text-slate-300 text-sm">#{tag}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
