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
    availableTags?: string[];
}

export function TagEditor({ tags, onAddTag, onRemoveTag, label, availableTags }: TagEditorProps) {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const vaultCache = useVaultStore((state) => state.metadataCache);
    const { tagConfig } = useSettingsStore();
    const allTags = useMemo(() => getTagsFromCache(vaultCache), [vaultCache]);
    
    const suggestions = useMemo(() => {
        const sourceTags = availableTags || allTags;
        if (!inputValue.trim()) {
            if (availableTags) {
                return availableTags.filter(t => !tags.includes(t)).sort();
            }
            return Object.keys(tagConfig)
                .filter(t => !tags.includes(t))
                .sort();
        }
        return sourceTags
            .filter(t => {
                if (tags.includes(t)) return false;
                const matchesTag = t.toLowerCase().includes(inputValue.toLowerCase());
                const rewrite = tagConfig[t]?.rewrite;
                const matchesRewrite = rewrite && rewrite.toLowerCase().includes(inputValue.toLowerCase());
                return matchesTag || matchesRewrite;
            })
            .slice(0, 10);
    }, [allTags, tags, inputValue, tagConfig, availableTags]);

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
        return (
            <MetadataChip
                key={`${tag}-${index}`}
                type="tag"
                name={tag}
                onRemove={() => onRemoveTag(index)}
            />
        );
    };

    const suggestionsUI = suggestions.length > 0 ? (
        <View className="max-h-40">
            <Text className="text-text-tertiary text-xs font-bold mb-2 uppercase">Suggestions</Text>
            <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                <View className="flex-row flex-wrap gap-2">
                    {suggestions.map(tag => {
                        return (
                            <MetadataChip
                                key={tag}
                                type="tag"
                                name={tag}
                                onPress={() => setInputValue(tag)}
                                variant="outline"
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
