import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useSettingsStore } from '../../store/settings';
import { MetadataChip } from '../ui/MetadataChip';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../ui/design-tokens';
import { useState } from 'react';

export function NewsFilterSettings() {
    const { newsFilterTerms, addNewsFilterTerm, removeNewsFilterTerm } = useSettingsStore();
    const [newTerm, setNewTerm] = useState('');

    const handleAdd = () => {
        const term = newTerm.trim().toLowerCase();
        if (term && !newsFilterTerms.includes(term)) {
            addNewsFilterTerm(term);
            setNewTerm('');
        }
    };

    return (
        <View className="flex-1 bg-surface p-4 rounded-xl">
            <Text className="text-white text-lg font-bold mb-2">Filter Terms</Text>
            <Text className="text-text-secondary text-sm mb-4">
                Articles containing these words in the title or description will be hidden.
            </Text>

            <View className="flex-row items-center gap-2 mb-4">
                <TextInput
                    className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-3"
                    placeholder="Enter word to block..."
                    placeholderTextColor={Colors.text.tertiary}
                    value={newTerm}
                    onChangeText={setNewTerm}
                    onSubmitEditing={handleAdd}
                    autoCapitalize="none"
                />
                <TouchableOpacity
                    className="bg-primary p-3 rounded-xl"
                    onPress={handleAdd}
                >
                    <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
                <View className="flex-row flex-wrap gap-2">
                    {newsFilterTerms.length === 0 ? (
                        <Text className="text-text-tertiary italic p-2">No active filters.</Text>
                    ) : (
                        newsFilterTerms.map(term => (
                            <MetadataChip
                                key={term}
                                label={term}
                                onRemove={() => removeNewsFilterTerm(term)}
                                variant="outline"
                                color={Colors.error}
                            />
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
