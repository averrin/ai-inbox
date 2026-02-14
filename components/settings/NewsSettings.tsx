import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { useState } from 'react';
import { Card } from '../ui/Card';

export function NewsSettings() {
    const { newsTopics, setNewsTopics } = useSettingsStore();
    const [newTopic, setNewTopic] = useState('');

    const handleAddTopic = () => {
        if (newTopic.trim()) {
            if (!newsTopics.includes(newTopic.trim())) {
                setNewsTopics([...newsTopics, newTopic.trim()]);
                setNewTopic('');
            }
        }
    };

    const handleDeleteTopic = (topic: string) => {
        setNewsTopics(newsTopics.filter(t => t !== topic));
    };

    return (
        <Card>
            <View className="mb-4">
                <Text className="text-indigo-200 mb-2 font-semibold">Configured Topics</Text>
                <Text className="text-slate-400 text-sm mb-4">
                    Add topics to customize your news feed.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                    {newsTopics.map((topic) => (
                        <View key={topic} className="bg-slate-800 border border-slate-700 rounded-full px-3 py-1 flex-row items-center">
                            <Text className="text-white mr-2">{topic}</Text>
                            <TouchableOpacity onPress={() => handleDeleteTopic(topic)}>
                                <Ionicons name="close-circle" size={16} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {newsTopics.length === 0 && (
                        <Text className="text-slate-500 italic">No topics added.</Text>
                    )}
                </View>

                <View className="flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3"
                        placeholder="Add a topic (e.g., Crypto)"
                        placeholderTextColor="#64748b"
                        value={newTopic}
                        onChangeText={setNewTopic}
                        onSubmitEditing={handleAddTopic}
                    />
                    <TouchableOpacity
                        onPress={handleAddTopic}
                        className="bg-indigo-600 p-3 rounded-xl"
                        disabled={!newTopic.trim()}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );
}
