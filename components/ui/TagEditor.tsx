import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVaultStore } from '../../services/vaultService';
import { getTagsFromCache } from '../../utils/tagUtils';
import { BaseEditor } from './BaseEditor';
import { Colors } from './design-tokens';

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

    const renderItem = (tag: string, index: number) => (
        <View key={`${tag}-${index}`} className="bg-primary px-2.5 py-1 rounded-md flex-row items-center border border-primary">
            <Text className="text-white mr-1 text-xs font-medium">{tag}</Text>
            <TouchableOpacity 
                onPress={() => onRemoveTag(index)} 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="close" size={10} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
        </View>
    );

    const suggestionsUI = suggestions.length > 0 ? (
        <View className="max-h-40">
            <Text className="text-text-tertiary text-xs font-bold mb-2 uppercase">Suggestions</Text>
            <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                <View className="flex-row flex-wrap gap-2">
                    {suggestions.map(tag => (
                        <TouchableOpacity
                            key={tag}
                            onPress={() => setInputValue(tag)}
                            className="bg-surface border border-border px-3 py-2 rounded-lg"
                        >
                            <Text className="text-text-secondary text-sm">#{tag}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    ) : null;

    return (
        <BaseEditor
            items={tags}
            renderItem={renderItem}
            onAdd={() => setIsModalVisible(true)}
            label={label}
            addLabel="Tag"
            modalTitle="Add Tag"
            isModalVisible={isModalVisible}
            onCloseModal={handleClose}
            onConfirm={handleConfirm}
            suggestions={suggestionsUI}
        >
            <TextInput
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Enter tag name..."
                placeholderTextColor={Colors.text.tertiary}
                className="bg-surface/50 border border-border rounded-xl p-4 text-white font-medium"
                onSubmitEditing={handleConfirm}
                returnKeyType="done"
                autoFocus
                autoCapitalize="none"
            />
        </BaseEditor>
    );
}
