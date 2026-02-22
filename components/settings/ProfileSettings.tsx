import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settings';
import { DEFAULT_VIZ_PROMPT } from '../../services/profileLogic';
import { Card } from '../ui/Card';
import { showAlert } from '../../utils/alert';
import Toast from 'react-native-toast-message';
import { DefaultedPrompt } from '../ui/DefaultedPrompt';


import { Button } from '../ui/Button';

export function ProfileSettings() {
    const { config, updateConfig } = useProfileStore();
    const { visualizationPrompt, setVisualizationPrompt } = useSettingsStore();
    const [targetTopic, setTargetTopic] = useState(config.targetTopic || '');
    const [questionCount, setQuestionCount] = useState(config.questionCount.toString());
    const [forbiddenTopics, setForbiddenTopics] = useState(config.forbiddenTopics.join(', '));

    const handleSave = () => {

        const count = parseInt(questionCount);
        if (isNaN(count) || count < 1) {
            showAlert('Invalid Input', 'Question count must be a number greater than 0');
            return;
        }

        const forbidden = forbiddenTopics.split(',').map(t => t.trim()).filter(t => t.length > 0);

        updateConfig({
            targetTopic: targetTopic.trim() || undefined,
            questionCount: count,
            forbiddenTopics: forbidden
        });

        Toast.show({
            type: 'success',
            text1: 'Success',
            text2: 'Profile settings updated.'
        });
    };

    return (
        <Card>
            <View className="space-y-4">
                <View>
                    <Text className="text-text-secondary mb-2 font-semibold">Target Topic (Optional)</Text>
                    <TextInput
                        className="bg-surface text-text-primary p-3 rounded-lg border border-border"
                        placeholder="e.g., Childhood, Career"
                        placeholderTextColor="#475569"
                        value={targetTopic}
                        onChangeText={setTargetTopic}
                    />
                    <Text className="text-secondary text-xs mt-1">
                        Leave empty to let the Architect decide based on gaps.
                    </Text>
                </View>

                <View>
                    <Text className="text-text-secondary mb-2 font-semibold">Daily Questions</Text>
                    <TextInput
                        className="bg-surface text-text-primary p-3 rounded-lg border border-border"
                        placeholder="3"
                        placeholderTextColor="#475569"
                        keyboardType="numeric"
                        value={questionCount}
                        onChangeText={setQuestionCount}
                    />
                </View>

                <View>
                    <Text className="text-text-secondary mb-2 font-semibold">Forbidden Topics</Text>
                    <TextInput
                        className="bg-surface text-text-primary p-3 rounded-lg border border-border h-24"
                        placeholder="Politics, Religion..."
                        placeholderTextColor="#475569"
                        multiline
                        textAlignVertical="top"
                        value={forbiddenTopics}
                        onChangeText={setForbiddenTopics}
                    />
                    <Text className="text-secondary text-xs mt-1">
                        Comma separated list of topics to avoid.
                    </Text>
                </View>

                <View className="pt-4 border-t border-border">
                    <Button title="Save General Settings" onPress={handleSave} />
                </View>

                <View className="pt-4 border-t border-border">
                    <DefaultedPrompt
                        title="Visualization Prompt"
                        description="Customize how the AI visualizes your profile data."
                        currentValue={visualizationPrompt}
                        defaultValue={DEFAULT_VIZ_PROMPT}
                        onSave={setVisualizationPrompt}
                        placeholders={['{{facts}}', '{{traits}}']}
                    />
                </View>
            </View>
        </Card>
    );
}
