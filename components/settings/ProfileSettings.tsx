import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useProfileStore } from '../../store/profileStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

export function ProfileSettings() {
    const { config, updateConfig } = useProfileStore();
    const [targetTopic, setTargetTopic] = useState(config.targetTopic || '');
    const [questionCount, setQuestionCount] = useState(config.questionCount.toString());
    const [forbiddenTopics, setForbiddenTopics] = useState(config.forbiddenTopics.join(', '));

    const handleSave = () => {
        const count = parseInt(questionCount);
        if (isNaN(count) || count < 1) {
            Alert.alert('Invalid Input', 'Question count must be a number greater than 0');
            return;
        }

        const forbidden = forbiddenTopics.split(',').map(t => t.trim()).filter(t => t.length > 0);

        updateConfig({
            targetTopic: targetTopic.trim() || undefined,
            questionCount: count,
            forbiddenTopics: forbidden
        });
        Alert.alert('Success', 'Profile settings updated.');
    };

    return (
        <Card>
            <View className="space-y-4">
                <View>
                    <Text className="text-indigo-200 mb-2 font-semibold">Target Topic (Optional)</Text>
                    <TextInput
                        className="bg-slate-800 text-slate-100 p-3 rounded-lg border border-slate-700"
                        placeholder="e.g., Childhood, Career"
                        placeholderTextColor="#475569"
                        value={targetTopic}
                        onChangeText={setTargetTopic}
                    />
                    <Text className="text-slate-500 text-xs mt-1">
                        Leave empty to let the Architect decide based on gaps.
                    </Text>
                </View>

                <View>
                    <Text className="text-indigo-200 mb-2 font-semibold">Daily Questions</Text>
                    <TextInput
                        className="bg-slate-800 text-slate-100 p-3 rounded-lg border border-slate-700"
                        placeholder="3"
                        placeholderTextColor="#475569"
                        keyboardType="numeric"
                        value={questionCount}
                        onChangeText={setQuestionCount}
                    />
                </View>

                <View>
                    <Text className="text-indigo-200 mb-2 font-semibold">Forbidden Topics</Text>
                    <TextInput
                        className="bg-slate-800 text-slate-100 p-3 rounded-lg border border-slate-700 h-24"
                        placeholder="Politics, Religion..."
                        placeholderTextColor="#475569"
                        multiline
                        textAlignVertical="top"
                        value={forbiddenTopics}
                        onChangeText={setForbiddenTopics}
                    />
                    <Text className="text-slate-500 text-xs mt-1">
                        Comma separated list of topics to avoid.
                    </Text>
                </View>

                <View className="pt-4 border-t border-slate-700">
                    <Button title="Save Changes" onPress={handleSave} />
                </View>
            </View>
        </Card>
    );
}
