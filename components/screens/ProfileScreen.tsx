import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settings';

export default function ProfileScreen() {
    const {
        profile,
        dailyQuestions,
        dailyReasoning,
        answers,
        isLoading,
        config,
        loadFromVault,
        generateQuestions,
        submitAnswers,
        setAnswer,
        updateConfig
    } = useProfileStore();

    const [settingsVisible, setSettingsVisible] = useState(false);
    const [targetTopic, setTargetTopic] = useState(config.targetTopic || '');
    const [forbiddenTopics, setForbiddenTopics] = useState(config.forbiddenTopics.join(', '));
    const [questionCount, setQuestionCount] = useState(config.questionCount.toString());

    useEffect(() => {
        loadFromVault();
    }, []);

    useEffect(() => {
        if (profile.lastUpdated) {
            generateQuestions();
        }
    }, [profile.lastUpdated]);

    const isAllAnswered = dailyQuestions.length > 0 && dailyQuestions.every(q => answers[q] && answers[q].trim().length > 0);

    const handleSaveSettings = () => {
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
        setSettingsVisible(false);
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                <View className="flex-row items-center gap-2">
                    <Ionicons name="person-outline" size={20} color="#818cf8" />
                    <Text className="text-slate-100 font-bold text-lg">Profile Builder</Text>
                </View>
                <TouchableOpacity
                    className="p-2 bg-slate-800 rounded-full"
                    onPress={() => {
                        setTargetTopic(config.targetTopic || '');
                        setForbiddenTopics(config.forbiddenTopics.join(', '));
                        setQuestionCount(config.questionCount.toString());
                        setSettingsVisible(true);
                    }}
                >
                    <Ionicons name="settings-outline" size={20} color="#94a3b8" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 100 }}>

                    {/* Status / Welcome */}
                    <View className="mb-6">
                        <Text className="text-slate-400 text-sm mb-1">
                            {dailyQuestions.length > 0 ? "Today's Interview" : "Status"}
                        </Text>
                        <Text className="text-slate-100 text-xl font-semibold">
                            {dailyQuestions.length > 0
                                ? "Deepen your profile context."
                                : "You're all caught up for today."}
                        </Text>
                        {dailyReasoning ? (
                            <View className="mt-2 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                                <View className="flex-row gap-2">
                                    <Ionicons name="sparkles-outline" size={14} color="#fbbf24" style={{ marginTop: 2 }} />
                                    <Text className="text-slate-400 text-xs italic flex-1">
                                        {dailyReasoning}
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                    </View>

                    {isLoading ? (
                        <View className="py-10 items-center">
                            <ActivityIndicator size="large" color="#818cf8" />
                            <Text className="text-slate-500 mt-4 text-sm">Consulting the Architect...</Text>
                        </View>
                    ) : (
                        <>
                            {/* Questions Section */}
                            {dailyQuestions.length > 0 ? (
                                <View className="space-y-6">
                                    {dailyQuestions.map((q, idx) => (
                                        <View key={idx} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                            <Text className="text-slate-200 font-medium mb-3 leading-6">
                                                {q}
                                            </Text>
                                            <TextInput
                                                className="bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-800 min-h-[80px]"
                                                placeholder="Your answer..."
                                                placeholderTextColor="#475569"
                                                multiline
                                                textAlignVertical="top"
                                                value={answers[q] || ''}
                                                onChangeText={(text) => setAnswer(q, text)}
                                            />
                                        </View>
                                    ))}

                                    <TouchableOpacity
                                        className={`py-4 rounded-xl items-center flex-row justify-center gap-2 mt-4 ${isAllAnswered ? 'bg-indigo-600' : 'bg-slate-800 opacity-50'}`}
                                        disabled={!isAllAnswered}
                                        onPress={submitAnswers}
                                    >
                                        <Text className={`font-bold text-lg ${isAllAnswered ? 'text-white' : 'text-slate-400'}`}>
                                            Submit Updates
                                        </Text>
                                        <Ionicons name="arrow-forward" size={20} color={isAllAnswered ? 'white' : '#94a3b8'} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                /* Profile Summary Section */
                                <View className="space-y-4">
                                    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                        <View className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex-row items-center gap-2">
                                            <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
                                            <Text className="text-slate-300 font-semibold">Current Profile Context</Text>
                                        </View>
                                        <View className="p-4">
                                            {Object.keys(profile.facts).length === 0 ? (
                                                <Text className="text-slate-500 italic text-center py-4">
                                                    Profile is empty. Check back tomorrow for questions!
                                                </Text>
                                            ) : (
                                                <View className="space-y-3">
                                                    {/* We can improve this visualization later. For now, JSON stringify nicely */}
                                                     <Text className="text-xs font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800">
                                                        {JSON.stringify(profile.facts, null, 2)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View className="bg-slate-950 px-4 py-2 border-t border-slate-800 flex-row justify-between items-center">
                                            <Text className="text-slate-500 text-xs">
                                                Last Updated: {new Date(profile.lastUpdated).toLocaleDateString()}
                                            </Text>
                                            <Text className="text-slate-500 text-xs">
                                                {profile.topics.length} Topics
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Settings Modal */}
            <Modal
                visible={settingsVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setSettingsVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-center items-center p-4">
                    <View className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-700 overflow-hidden">
                        <View className="px-4 py-3 border-b border-slate-800 flex-row justify-between items-center bg-slate-800">
                            <Text className="text-slate-100 font-bold text-lg">Configuration</Text>
                            <TouchableOpacity onPress={() => setSettingsVisible(false)}>
                                <Ionicons name="close" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="p-4 space-y-4">
                            <View>
                                <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Target Topic (Optional)</Text>
                                <TextInput
                                    className="bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-700"
                                    placeholder="e.g., Childhood, Career"
                                    placeholderTextColor="#475569"
                                    value={targetTopic}
                                    onChangeText={setTargetTopic}
                                />
                                <Text className="text-slate-600 text-[10px] mt-1">
                                    Leave empty to let the Architect decide based on gaps.
                                </Text>
                            </View>

                            <View>
                                <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Daily Questions</Text>
                                <TextInput
                                    className="bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-700"
                                    placeholder="3"
                                    placeholderTextColor="#475569"
                                    keyboardType="numeric"
                                    value={questionCount}
                                    onChangeText={setQuestionCount}
                                />
                            </View>

                            <View>
                                <Text className="text-slate-400 text-xs font-bold uppercase mb-2">Forbidden Topics</Text>
                                <TextInput
                                    className="bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-700 h-24"
                                    placeholder="Politics, Religion..."
                                    placeholderTextColor="#475569"
                                    multiline
                                    textAlignVertical="top"
                                    value={forbiddenTopics}
                                    onChangeText={setForbiddenTopics}
                                />
                                <Text className="text-slate-600 text-[10px] mt-1">
                                    Comma separated list of topics to avoid.
                                </Text>
                            </View>
                        </ScrollView>

                        <View className="p-4 border-t border-slate-800">
                            <TouchableOpacity
                                className="bg-indigo-600 py-3 rounded-xl items-center"
                                onPress={handleSaveSettings}
                            >
                                <Text className="text-white font-bold">Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
