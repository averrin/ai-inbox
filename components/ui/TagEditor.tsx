import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVaultStore } from '../../services/vaultService';
import { useSettingsStore } from '../../store/settings';
import { getTagsFromCache } from '../../utils/tagUtils';
import { BaseEditor } from './BaseEditor';
import { Colors } from './design-tokens';
import { MetadataChip } from './MetadataChip';

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
    const { tagConfig } = useSettingsStore();
    const allTags = useMemo(() => getTagsFromCache(vaultCache), [vaultCache]);
    
    const suggestions = useMemo(() => {
        if (!inputValue.trim()) {
            return Object.keys(tagConfig)
                .filter(t => !tags.includes(t))
                .sort();
        }
        return allTags
            .filter(t => !tags.includes(t) && t.toLowerCase().includes(inputValue.toLowerCase()))
            .slice(0, 10);
    }, [allTags, tags, inputValue, tagConfig]);

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

    const renderItem = (tag: string, index: number) => {
        const config = tagConfig[tag];
        return (
            <MetadataChip
                key={`${tag}-${index}`}
                label={`#${tag}`}
                color={config?.color}
                variant="solid"
                onRemove={() => onRemoveTag(index)}
                size="md"
            />
        );
    };

    const suggestionsUI = suggestions.length > 0 ? (
        <View className="max-h-40">
            <Text className="text-text-tertiary text-xs font-bold mb-2 uppercase">Suggestions</Text>
            <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                <View className="flex-row flex-wrap gap-2">
                    {suggestions.map(tag => {
                        const config = tagConfig[tag];
                        return (
                            <MetadataChip
                                key={tag}
                                label={`#${tag}`}
                                color={config?.color}
                                onPress={() => setInputValue(tag)}
                                variant="outline"
                                size="md"
                            />
                        );
                    })}
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
