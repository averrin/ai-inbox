import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../../store/profileStore';
import { useSettingsStore } from '../../store/settings';

export default function ProfileScreen() {
    const [editingFact, setEditingFact] = useState<{ key: string, value: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const {
        profile,
        dailyQuestions,
        dailyReasoning,
        answers,
        isLoading,
        isGeneratingImage,
        config,
        loadFromVault,
        generateQuestions,
        submitAnswers,
        generateProfileImage,
        setAnswer,
        updateConfig,
        deleteFact,
        updateFact
    } = useProfileStore();

    useEffect(() => {
        console.log('[ProfileScreen] Mounted, calling loadFromVault');
        loadFromVault();
    }, []);

    useEffect(() => {
        if (profile.lastUpdated) {
            console.log('[ProfileScreen] Profile updated, lastUpdated:', profile.lastUpdated);
            generateQuestions();
        }
    }, [profile.lastUpdated]);

    const isAllAnswered = dailyQuestions.length > 0 && dailyQuestions.every(q => {
        const text = typeof q === 'string' ? q : q?.text;
        return answers[text] && answers[text].trim().length > 0;
    });

    const handleEditFact = (key: string, value: any) => {
        setEditingFact({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
    };

    const handleSaveEdit = async () => {
        if (editingFact) {
            await updateFact(editingFact.key, editingFact.value);
            setEditingFact(null);
        }
    };

    const handleDeleteFact = (key: string) => {
        Alert.alert(
            "Delete Fact",
            `Are you sure you want to remove this information: "${key}"?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => deleteFact(key) }
            ]
        );
    };

    const filterFacts = () => {
        if (!searchQuery) return Object.entries(profile.facts);
        const lowQuery = searchQuery.toLowerCase();
        return Object.entries(profile.facts).filter(([key, value]) => 
            key.toLowerCase().includes(lowQuery) || 
            String(value).toLowerCase().includes(lowQuery)
        );
    };

    const filteredFacts = filterFacts();

    const getLevelLabel = (level: number) => {
        if (level <= 0.3) return { label: 'Fact', color: 'text-blue-400', bg: 'bg-blue-500/10' };
        if (level <= 0.7) return { label: 'Routine', color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
        return { label: 'Value', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'left', 'right']}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
                <View className="flex-row items-center gap-2">
                    <Ionicons name="person-outline" size={20} color="#818cf8" />
                    <Text className="text-slate-100 font-bold text-lg">Profile Builder</Text>
                </View>
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
                                <View className="space-y-6 flex-col gap-1">
                                    {dailyQuestions.map((q, idx) => {
                                        const qText = typeof q === 'string' ? q : q.text;
                                        const qLevel = typeof q === 'string' ? 0.5 : q.level;
                                        return (
                                            <View key={idx} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                <View className="flex-row justify-between items-start mb-3">
                                                    <Text className="text-slate-200 font-medium leading-6 flex-1 mr-4">
                                                        {qText}
                                                    </Text>
                                                    <View className={`px-2 py-0.5 rounded ${getLevelLabel(qLevel).bg}`}>
                                                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${getLevelLabel(qLevel).color}`}>
                                                            {getLevelLabel(qLevel).label}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <TextInput
                                                    className="bg-slate-950 text-slate-100 p-3 rounded-lg border border-slate-800 min-h-[80px]"
                                                    placeholder="Your answer..."
                                                    placeholderTextColor="#475569"
                                                    multiline
                                                    textAlignVertical="top"
                                                    value={answers[qText] || ''}
                                                    onChangeText={(text) => setAnswer(qText, text)}
                                                />
                                            </View>
                                        );
                                    })}

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
                                    {/* Profile Image / Diorama */}
                                    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-2">
                                        <View className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex-row items-center justify-between">
                                            <View className="flex-row items-center gap-2">
                                                <Ionicons name="image-outline" size={16} color="#94a3b8" />
                                                <Text className="text-slate-300 font-semibold">Inner World</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => generateProfileImage()} disabled={isGeneratingImage}>
                                                {isGeneratingImage ? (
                                                    <ActivityIndicator size="small" color="#818cf8" />
                                                ) : (
                                                    <Ionicons name="refresh" size={16} color="#94a3b8" />
                                                )}
                                            </TouchableOpacity>
                                        </View>

                                        {profile.profileImage ? (
                                            <Image
                                                source={{ uri: profile.profileImage }}
                                                style={{ width: '100%', height: 200 }}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View className="h-40 items-center justify-center bg-slate-950/50">
                                                <Text className="text-slate-500 italic text-xs">
                                                    {isGeneratingImage ? "Generating visualization..." : "No visualization generated yet"}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Abstraction Level Selector */}
                                    <View className="bg-slate-900 rounded-xl border border-slate-800 p-4 mb-2">
                                        <View className="flex-row justify-between items-center mb-4">
                                            <View>
                                                <Text className="text-slate-300 font-semibold">Depth Preference</Text>
                                                <Text className="text-slate-500 text-xs">AI curiosity level</Text>
                                            </View>
                                            <View className={`px-3 py-1 rounded-full ${getLevelLabel(config.abstractionLevel).bg}`}>
                                                <Text className={`text-xs font-bold ${getLevelLabel(config.abstractionLevel).color}`}>
                                                    {config.abstractionLevel < 0.35 ? "Concrete Facts" : config.abstractionLevel < 0.65 ? "Habits & Routine" : "Deep Philosophy"}
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <View className="flex-row items-center gap-3">
                                            <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Low</Text>
                                            <View className="flex-1 h-1.5 bg-slate-950 rounded-full flex-row overflow-hidden border border-slate-800">
                                                <TouchableOpacity 
                                                    className={`flex-1 ${config.abstractionLevel <= 0.33 ? 'bg-indigo-500' : 'bg-transparent'}`}
                                                    onPress={() => updateConfig({ abstractionLevel: 0.2 })}
                                                />
                                                <TouchableOpacity 
                                                    className={`flex-1 border-x border-slate-800 ${config.abstractionLevel > 0.33 && config.abstractionLevel <= 0.66 ? 'bg-indigo-500' : 'bg-transparent'}`}
                                                    onPress={() => updateConfig({ abstractionLevel: 0.5 })}
                                                />
                                                <TouchableOpacity 
                                                    className={`flex-1 ${config.abstractionLevel > 0.66 ? 'bg-indigo-500' : 'bg-transparent'}`}
                                                    onPress={() => updateConfig({ abstractionLevel: 0.8 })}
                                                />
                                            </View>
                                            <Text className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">High</Text>
                                        </View>
                                    </View>

                                    <View className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                        <View className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex-row items-center gap-2">
                                            <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
                                            <Text className="text-slate-300 font-semibold">Current Profile Context</Text>
                                        </View>
                                        
                                        {/* Search Bar */}
                                        {Object.keys(profile.facts).length > 0 && (
                                            <View className="px-3 pt-3 pb-1">
                                                <View className="flex-row items-center bg-slate-950 rounded-lg border border-slate-800 px-3 py-2">
                                                    <Ionicons name="search-outline" size={16} color="#475569" />
                                                    <TextInput
                                                        className="flex-1 ml-2 text-slate-200 text-sm h-6 p-0"
                                                        placeholder="Search facts..."
                                                        placeholderTextColor="#475569"
                                                        value={searchQuery}
                                                        onChangeText={setSearchQuery}
                                                    />
                                                    {searchQuery ? (
                                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                                            <Ionicons name="close-circle" size={16} color="#475569" />
                                                        </TouchableOpacity>
                                                    ) : null}
                                                </View>
                                            </View>
                                        )}

                                        <View className="p-2">
                                            {Object.keys(profile.facts).length === 0 ? (
                                                <Text className="text-slate-500 italic text-center py-4">
                                                    Profile is empty. Click "Ask More Questions" to start!
                                                </Text>
                                            ) : filteredFacts.length === 0 ? (
                                                <Text className="text-slate-500 italic text-center py-8">
                                                    No results for "{searchQuery}"
                                                </Text>
                                            ) : (
                                                <ScrollView 
                                                    nestedScrollEnabled={true} 
                                                    style={{ maxHeight: 300 }}
                                                    contentContainerStyle={{ paddingBottom: 10 }}
                                                >
                                                    {filteredFacts.map(([key, value]) => (
                                                        <View key={key} className="flex-row items-center border-b border-slate-800/50 py-3 px-2">
                                                            <View className="flex-1">
                                                                <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mb-0.5">{key}</Text>
                                                                <Text className="text-slate-200 text-sm leading-5">
                                                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                </Text>
                                                            </View>
                                                            <View className="flex-row gap-1">
                                                                <TouchableOpacity 
                                                                    className="p-2"
                                                                    onPress={() => handleEditFact(key, value)}
                                                                >
                                                                    <Ionicons name="pencil-outline" size={16} color="#6366f1" />
                                                                </TouchableOpacity>
                                                                <TouchableOpacity 
                                                                    className="p-2"
                                                                    onPress={() => handleDeleteFact(key)}
                                                                >
                                                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            )}
                                        </View>
                                        <View className="bg-slate-950 px-4 py-2 border-t border-slate-800 flex-row justify-between items-center">
                                            <Text className="text-slate-500 text-xs">
                                                Last Updated: {new Date(profile.lastUpdated).toLocaleDateString()}
                                            </Text>
                                            <Text className="text-slate-500 text-xs">
                                                {filteredFacts.length} {filteredFacts.length === 1 ? 'Fact' : 'Facts'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* More Questions Button */}
                                    <TouchableOpacity
                                        className="bg-slate-800 py-3 rounded-xl items-center flex-row justify-center gap-2 border border-slate-700 mt-4"
                                        onPress={() => generateQuestions(true)}
                                    >
                                        <Ionicons name="refresh-outline" size={18} color="#94a3b8" />
                                        <Text className="text-slate-300 font-medium">
                                            Ask More Questions
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Edit Fact Modal */}
            <Modal
                visible={!!editingFact}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingFact(null)}
            >
                <View className="flex-1 bg-black/60 justify-center px-6">
                    <View className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
                        <Text className="text-slate-400 text-xs uppercase font-bold tracking-widest mb-1">
                            Edit Property
                        </Text>
                        <Text className="text-slate-100 text-lg font-bold mb-4">
                            {editingFact?.key}
                        </Text>

                        <TextInput
                            className="bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 min-h-[120px]"
                            multiline
                            textAlignVertical="top"
                            value={editingFact?.value || ''}
                            onChangeText={(text) => setEditingFact(prev => prev ? { ...prev, value: text } : null)}
                            autoFocus
                        />

                        <View className="flex-row gap-3 mt-6">
                            <TouchableOpacity
                                className="flex-1 bg-slate-800 py-4 rounded-xl items-center"
                                onPress={() => setEditingFact(null)}
                            >
                                <Text className="text-slate-300 font-bold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-indigo-600 py-4 rounded-xl items-center"
                                onPress={handleSaveEdit}
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
