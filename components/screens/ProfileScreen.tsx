import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { MessageDialog } from '../ui/MessageDialog';
import { ImageAttachmentButton } from '../ui/ImageAttachmentButton';
import { JulesLoader } from '../ui/JulesLoader';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    cancelAnimation
} from 'react-native-reanimated';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView
} from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';
import { useFocusEffect } from '@react-navigation/native';

import { useProfileStore } from '../../store/profileStore';
import { analyzeImage } from '../../services/gemini';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { Colors, Palette } from '../ui/design-tokens';

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const [editingFact, setEditingFact] = useState<{ key: string, value: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isImageFull, setIsImageFull] = useState(false);
    const [activeTab, setActiveTab] = useState<'home' | 'details'>('home');
    const [showDepthModal, setShowDepthModal] = useState(false);
    const [isAddingFact, setIsAddingFact] = useState(false);
    const [questionImages, setQuestionImages] = useState<Record<string, { base64: string, mimeType?: string }>>({});
    const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);
    const { apiKey, selectedModel } = useSettingsStore();

    const { setFab, clearFab } = useUIStore();

    // Configure FAB based on active tab
    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'home') {
                setFab({
                    visible: true,
                    icon: 'add',
                    onPress: () => setShowDepthModal(true),
                    color: '#4f46e5',
                    iconColor: 'white'
                });
            } else {
                setFab({
                    visible: true,
                    icon: 'add',
                    onPress: () => setIsAddingFact(true),
                    color: '#4f46e5',
                    iconColor: 'white'
                });
            }

            return () => clearFab();
        }, [activeTab, setFab, clearFab])
    );

    // Gesture shared values
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const resetGestures = () => {
        'worklet';
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    };

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
            if (scale.value < 1) {
                resetGestures();
            }
        });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
            if (scale.value <= 1) {
                resetGestures();
            }
        });

    const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

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
        updateFact,
        addFactFromText
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
        // Allow image-only answers or text answers
        return (answers[text] && answers[text].trim().length > 0) || questionImages[text];
    });

    const handleSubmitAnswers = async () => {
        setIsAnalyzingImages(true);
        try {
            // Process images first
            for (const qText of Object.keys(questionImages)) {
                const img = questionImages[qText];
                if (img) {
                    try {
                        const analysis = await analyzeImage(
                            apiKey!,
                            img.base64,
                            `Question: "${qText}"\nUser Answer Context: "${answers[qText] || ''}"\n\nAnalyze this image to extract relevant details to answer the question about the user.`,
                            img.mimeType,
                            selectedModel || 'gemini-1.5-flash'
                        );

                        if (analysis) {
                            const current = answers[qText] || '';
                            const combined = current + (current ? '\n\n' : '') + `[Image Analysis]: ${analysis}`;
                            setAnswer(qText, combined);
                        }
                    } catch (e) {
                        console.error('Failed to analyze image for', qText, e);
                        Toast.show({
                            type: 'error',
                            text1: 'Image Analysis Failed',
                            text2: `Could not analyze image for "${qText.substring(0, 20)}..."`
                        });
                    }
                }
            }

            // Wait a tick for state updates to propagate if needed (though setAnswer is sync in Zustand usually,
            // but effectively we are batching updates. Zustand updates are immediate).
            // However, since we are inside an async function, the state `answers` from `useProfileStore` hook
            // might not reflect the immediate `setAnswer` calls if we read it again.
            // BUT `submitAnswers` inside the store reads `get().answers`, so it will see the updates!

            await submitAnswers();
            setQuestionImages({});
        } catch (e) {
             console.error('Submit failed', e);
        } finally {
            setIsAnalyzingImages(false);
        }
    };

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

    const handleCopyContext = async () => {
        try {
            const contextJson = JSON.stringify({
                facts: profile.facts,
                traits: profile.traits || [],
                lastUpdated: profile.lastUpdated
            }, null, 2);

            await Clipboard.setStringAsync(contextJson);
            Toast.show({
                type: 'success',
                text1: 'Context Copied',
                text2: 'JSON representation saved to clipboard'
            });
        } catch (error) {
            console.error('[ProfileScreen] Copy failed:', error);
            Alert.alert('Copy Failed', 'Could not copy context to clipboard.');
        }
    };

    const handleShareImage = async () => {
        if (!profile.profileImage) return;

        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
                return;
            }

            await Sharing.shareAsync(profile.profileImage, {
                mimeType: 'image/png',
                dialogTitle: 'Share your Inner World',
                UTI: 'public.png'
            });
        } catch (error) {
            console.error('[ProfileScreen] Share failed:', error);
            Alert.alert('Share Failed', 'Could not share the image.');
        }
    };

    const handleCopyImage = async () => {
        if (!profile.profileImage) return;

        try {
            // expo-clipboard setImageAsync is currently limited on some platforms/versions
            // but we can try it or fall back to notifying the user
            const base64 = await FileSystem.readAsStringAsync(profile.profileImage, {
                encoding: 'base64'
            });

            await Clipboard.setImageAsync(base64);
            Toast.show({
                type: 'success',
                text1: 'Image Copied',
                text2: 'Visualization copied to clipboard'
            });
        } catch (error) {
            console.error('[ProfileScreen] Copy image failed:', error);
            // Fallback: Just share it if copy is not supported
            handleShareImage();
        }
    };


    const getLevelLabel = (level: number) => {
        if (level <= 0.3) return { label: 'Fact', color: 'text-primary', bg: 'bg-primary/10' };
        if (level <= 0.7) return { label: 'Routine', color: 'text-primary', bg: 'bg-primary' };
        return { label: 'Value', color: 'text-warning', bg: 'bg-warning' };
    };

    // Custom Tab Component for IslandHeader containing Title and Tabs
    const TabToggle = () => (
        <View className="flex-row items-center pl-2 pr-1">
            <Text className="text-white font-bold text-lg leading-tight mr-3">
                Profile
            </Text>
            <View className="flex-row items-center bg-surface rounded-full p-0.5">
                <TouchableOpacity
                    onPress={() => setActiveTab('home')}
                    className={`flex-row items-center px-3 py-1.5 rounded-full ${activeTab === 'home' ? 'bg-surface-highlight' : 'bg-transparent'}`}
                >
                    <Ionicons
                        name={activeTab === 'home' ? "home" : "home-outline"}
                        size={16}
                        color={activeTab === 'home' ? "white" : Colors.text.tertiary}
                    />
                    <Text className={`ml-1.5 text-xs font-bold ${activeTab === 'home' ? 'text-white' : 'text-text-tertiary'}`}>
                        Home
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setActiveTab('details')}
                    className={`flex-row items-center px-3 py-1.5 rounded-full ${activeTab === 'details' ? 'bg-surface-highlight' : 'bg-transparent'}`}
                >
                    <Ionicons
                        name={activeTab === 'details' ? "list" : "list-outline"}
                        size={16}
                        color={activeTab === 'details' ? "white" : Colors.text.tertiary}
                    />
                    <Text className={`ml-1.5 text-xs font-bold ${activeTab === 'details' ? 'text-white' : 'text-text-tertiary'}`}>
                        Details
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Layout>
            <IslandHeader
                title="Profile"
                leftContent={<TabToggle />}
                rightActions={[
                    { icon: 'share-outline', onPress: handleCopyContext }
                ]}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

                    {/* Status / Welcome */}
                    <View className="mb-6">
                        <Text className="text-text-tertiary text-sm mb-1">
                            {dailyQuestions.length > 0 ? "Today's Interview" : "Status"}
                        </Text>
                        <Text className="text-text-primary text-xl font-semibold">
                            {dailyQuestions.length > 0
                                ? "Deepen your profile context."
                                : "You're all caught up for today."}
                        </Text>
                        {dailyReasoning ? (
                            <View className="mt-2 p-3 bg-background/50 rounded-lg border border-border">
                                <View className="flex-row gap-2">
                                    <Ionicons name="sparkles-outline" size={14} color="#fbbf24" style={{ marginTop: 2 }} />
                                    <Text className="text-text-tertiary text-xs italic flex-1">
                                        {dailyReasoning}
                                    </Text>
                                </View>
                            </View>
                        ) : null}
                    </View>

                    {isLoading ? (
                        <View className="py-10 items-center">
                            <JulesLoader size="large" message="Consulting the Architect..." />
                        </View>
                    ) : (
                        <>
                            {/* Main Content Area */}
                            <View className="space-y-4">
                                {activeTab === 'home' ? (
                                    <>
                                        {/* Questions Section (Daily Interview) */}
                                        {dailyQuestions.length > 0 && (
                                            <View className="space-y-6 flex-col gap-1 mb-4">
                                                {dailyQuestions.map((q, idx) => {
                                                    const qText = typeof q === 'string' ? q : q.text;
                                                    const qLevel = typeof q === 'string' ? 0.5 : q.level;
                                                    return (
                                                        <View key={idx} className="bg-background p-4 rounded-xl border border-border">
                                                            <View className="flex-row justify-between items-start mb-3">
                                                                <Text className="text-text-primary font-medium leading-6 flex-1 mr-4">
                                                                    {qText}
                                                                </Text>
                                                                <View className={`px-2 py-0.5 rounded ${getLevelLabel(qLevel).bg}`}>
                                                                    <Text className={`text-[10px] font-bold uppercase tracking-wider ${getLevelLabel(qLevel).color}`}>
                                                                        {getLevelLabel(qLevel).label}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                            <View className="relative">
                                                                {questionImages[qText] && (
                                                                    <View className="mb-2 relative rounded-lg overflow-hidden h-32 bg-slate-950 items-center justify-center border border-border mx-3 mt-3">
                                                                        <Image
                                                                            source={{ uri: `data:${questionImages[qText].mimeType || 'image/jpeg'};base64,${questionImages[qText].base64}` }}
                                                                            style={{ width: '100%', height: '100%' }}
                                                                            resizeMode="contain"
                                                                        />
                                                                        <TouchableOpacity
                                                                            onPress={() => {
                                                                                const newImages = {...questionImages};
                                                                                delete newImages[qText];
                                                                                setQuestionImages(newImages);
                                                                            }}
                                                                            className="absolute top-2 right-2 bg-black/50 p-1 rounded-full"
                                                                        >
                                                                            <Ionicons name="close" size={16} color="white" />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                )}
                                                                <TextInput
                                                                    className="bg-slate-950 text-text-primary p-3 rounded-lg border border-border min-h-[80px] pb-10"
                                                                    placeholder="Your answer..."
                                                                    placeholderTextColor="#475569"
                                                                    multiline
                                                                    textAlignVertical="top"
                                                                    value={answers[qText] || ''}
                                                                    onChangeText={(text) => setAnswer(qText, text)}
                                                                />
                                                                <View className="absolute bottom-2 right-2">
                                                                    <ImageAttachmentButton
                                                                        onImageSelected={(base64, mimeType) => setQuestionImages(prev => ({ ...prev, [qText]: { base64, mimeType } }))}
                                                                        className={`bg-surface/80 ${questionImages[qText] ? 'border-primary bg-primary' : ''}`}
                                                                    />
                                                                </View>
                                                            </View>
                                                        </View>
                                                    );
                                                })}

                                                <TouchableOpacity
                                                    className={`py-4 rounded-xl items-center flex-row justify-center gap-2 mt-2 ${isAllAnswered ? 'bg-primary' : 'bg-surface opacity-50'}`}
                                                    disabled={!isAllAnswered || isAnalyzingImages}
                                                    onPress={handleSubmitAnswers}
                                                >
                                                    {isAnalyzingImages ? (
                                                        <ActivityIndicator color="white" />
                                                    ) : (
                                                        <>
                                                            <Text className={`font-bold text-lg ${isAllAnswered ? 'text-white' : 'text-text-tertiary'}`}>
                                                                Submit Updates
                                                            </Text>
                                                            <Ionicons name="arrow-forward" size={20} color={isAllAnswered ? 'white' : Colors.text.tertiary} />
                                                        </>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Profile Image / Diorama (Visualization) */}
                                        <View className="bg-background rounded-xl border border-border overflow-hidden mb-2">
                                            <View className="bg-surface/50 px-4 py-3 border-b border-border flex-row items-center justify-between">
                                                <View className="flex-row items-center gap-2">
                                                    <Ionicons name="image-outline" size={16} color={Colors.text.tertiary} />
                                                    <Text className="text-text-secondary font-semibold">Inner World</Text>
                                                </View>
                                                <View className="flex-row items-center gap-4">
                                                    {profile.profileImage && (
                                                        <>
                                                            <TouchableOpacity onPress={handleShareImage}>
                                                                <Ionicons name="share-outline" size={16} color="#818cf8" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={handleCopyImage}>
                                                                <Ionicons name="copy-outline" size={16} color="#818cf8" />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={() => setIsImageFull(true)}>
                                                                <Ionicons name="expand-outline" size={16} color="#818cf8" />
                                                            </TouchableOpacity>
                                                        </>
                                                    )}
                                                    <TouchableOpacity onPress={() => generateProfileImage()} disabled={isGeneratingImage}>
                                                        {isGeneratingImage ? (
                                                            <ActivityIndicator size="small" color="#818cf8" />
                                                        ) : (
                                                            <Ionicons name="refresh" size={16} color={Colors.text.tertiary} />
                                                        )}
                                                    </TouchableOpacity>
                                                </View>

                                            </View>

                                            {profile.profileImage ? (
                                                <TouchableOpacity
                                                    activeOpacity={0.9}
                                                    onPress={() => setIsImageFull(true)}
                                                >
                                                    <Image
                                                        source={{ uri: profile.profileImage }}
                                                        style={{ width: '100%', height: 200 }}
                                                        resizeMode="cover"
                                                    />
                                                </TouchableOpacity>
                                            ) : (
                                                <View className="h-40 items-center justify-center bg-slate-950/50">
                                                    <Text className="text-secondary italic text-xs">
                                                        {isGeneratingImage ? "Generating visualization..." : "No visualization generated yet"}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        {/* Abstraction Level Selector */}
                                        <View className="bg-background rounded-xl border border-border p-4 mb-2">
                                            <View className="flex-row justify-between items-center mb-4">
                                                <View>
                                                    <Text className="text-text-secondary font-semibold">Depth Preference</Text>
                                                    <Text className="text-secondary text-xs">AI curiosity level</Text>
                                                </View>
                                                <View className={`px-3 py-1 rounded-full ${getLevelLabel(config.abstractionLevel).bg}`}>
                                                    <Text className={`text-xs font-bold ${getLevelLabel(config.abstractionLevel).color}`}>
                                                        {config.abstractionLevel < 0.35 ? "Concrete Facts" : config.abstractionLevel < 0.65 ? "Habits & Routine" : "Deep Philosophy"}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View className="flex-row items-center gap-3">
                                                <Text className="text-[10px] text-secondary font-bold uppercase tracking-wider">Low</Text>
                                                <View className="flex-1 h-1.5 bg-slate-950 rounded-full flex-row overflow-hidden border border-border">
                                                    <TouchableOpacity
                                                        className={`flex-1 ${config.abstractionLevel <= 0.33 ? 'bg-primary' : 'bg-transparent'}`}
                                                        onPress={() => updateConfig({ abstractionLevel: 0.2 })}
                                                    />
                                                    <TouchableOpacity
                                                        className={`flex-1 border-x border-border ${config.abstractionLevel > 0.33 && config.abstractionLevel <= 0.66 ? 'bg-primary' : 'bg-transparent'}`}
                                                        onPress={() => updateConfig({ abstractionLevel: 0.5 })}
                                                    />
                                                    <TouchableOpacity
                                                        className={`flex-1 ${config.abstractionLevel > 0.66 ? 'bg-primary' : 'bg-transparent'}`}
                                                        onPress={() => updateConfig({ abstractionLevel: 0.8 })}
                                                    />
                                                </View>
                                                <Text className="text-[10px] text-secondary font-bold uppercase tracking-wider">High</Text>
                                            </View>
                                        </View>

                                        <View className="bg-background rounded-xl border border-border overflow-hidden">
                                            <View className="bg-surface/50 px-4 py-3 border-b border-border flex-row items-center justify-between">
                                                <View className="flex-row items-center gap-2">
                                                    <Ionicons name="document-text-outline" size={16} color={Colors.text.tertiary} />
                                                    <Text className="text-text-secondary font-semibold">Current Profile Context</Text>
                                                </View>
                                            </View>

                                            {/* Search Bar */}
                                            {Object.keys(profile.facts).length > 0 && (
                                                <View className="px-3 pt-3 pb-1">
                                                    <View className="flex-row items-center bg-slate-950 rounded-lg border border-border px-3 py-2">
                                                        <Ionicons name="search-outline" size={16} color="#475569" />
                                                        <TextInput
                                                            className="flex-1 ml-2 text-text-primary text-sm h-6 p-0"
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
                                                    <Text className="text-secondary italic text-center py-4">
                                                        Profile is empty. Click "Ask More Questions" to start!
                                                    </Text>
                                                ) : filteredFacts.length === 0 ? (
                                                    <Text className="text-secondary italic text-center py-8">
                                                        No results for "{searchQuery}"
                                                    </Text>
                                                ) : (
                                                    <ScrollView
                                                        nestedScrollEnabled={true}
                                                        style={{ maxHeight: 400 }}
                                                        contentContainerStyle={{ paddingBottom: 10 }}
                                                    >
                                                        {filteredFacts.map(([key, value]) => (
                                                            <View key={key} className="flex-row items-center border-b border-border py-3 px-2">
                                                                <View className="flex-1">
                                                                    <Text className="text-secondary text-[10px] uppercase font-bold tracking-wider mb-0.5">{key}</Text>
                                                                    <Text className="text-text-primary text-sm leading-5">
                                                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                    </Text>
                                                                </View>
                                                                <View className="flex-row gap-1">
                                                                    <TouchableOpacity
                                                                        className="p-2"
                                                                        onPress={() => handleEditFact(key, value)}
                                                                    >
                                                                        <Ionicons name="pencil-outline" size={16} color={Palette[14]} />
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity
                                                                        className="p-2"
                                                                        onPress={() => handleDeleteFact(key)}
                                                                    >
                                                                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </ScrollView>
                                                )}
                                            </View>
                                            <View className="bg-slate-950 px-4 py-2 border-t border-border flex-row justify-between items-center">
                                                <Text className="text-secondary text-xs">
                                                    Last Updated: {new Date(profile.lastUpdated).toLocaleDateString()}
                                                </Text>
                                                <Text className="text-secondary text-xs">
                                                    {filteredFacts.length} {filteredFacts.length === 1 ? 'Fact' : 'Facts'}
                                                </Text>
                                            </View>
                                        </View>
                                    </>
                                )}
                            </View>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Depth Preference Modal */}
            <Modal
                visible={showDepthModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDepthModal(false)}
            >
                <View className="flex-1 bg-black/60 justify-center px-6">
                    <View className="bg-background border border-border rounded-2xl p-6 shadow-2xl">
                        <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest mb-4">
                            Configure Questions
                        </Text>

                        <View className="bg-slate-950/50 rounded-xl border border-border p-4 mb-6">
                            <View className="flex-row justify-between items-center mb-4">
                                <View>
                                    <Text className="text-text-secondary font-semibold">Depth Preference</Text>
                                    <Text className="text-secondary text-xs">AI curiosity level</Text>
                                </View>
                                <View className={`px-3 py-1 rounded-full ${getLevelLabel(config.abstractionLevel).bg}`}>
                                    <Text className={`text-xs font-bold ${getLevelLabel(config.abstractionLevel).color}`}>
                                        {config.abstractionLevel < 0.35 ? "Concrete Facts" : config.abstractionLevel < 0.65 ? "Habits & Routine" : "Deep Philosophy"}
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row items-center gap-3">
                                <Text className="text-[10px] text-secondary font-bold uppercase tracking-wider">Low</Text>
                                <View className="flex-1 h-1.5 bg-slate-950 rounded-full flex-row overflow-hidden border border-border">
                                    <TouchableOpacity
                                        className={`flex-1 ${config.abstractionLevel <= 0.33 ? 'bg-primary' : 'bg-transparent'}`}
                                        onPress={() => updateConfig({ abstractionLevel: 0.2 })}
                                    />
                                    <TouchableOpacity
                                        className={`flex-1 border-x border-border ${config.abstractionLevel > 0.33 && config.abstractionLevel <= 0.66 ? 'bg-primary' : 'bg-transparent'}`}
                                        onPress={() => updateConfig({ abstractionLevel: 0.5 })}
                                    />
                                    <TouchableOpacity
                                        className={`flex-1 ${config.abstractionLevel > 0.66 ? 'bg-primary' : 'bg-transparent'}`}
                                        onPress={() => updateConfig({ abstractionLevel: 0.8 })}
                                    />
                                </View>
                                <Text className="text-[10px] text-secondary font-bold uppercase tracking-wider">High</Text>
                            </View>
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-surface py-4 rounded-xl items-center"
                                onPress={() => setShowDepthModal(false)}
                            >
                                <Text className="text-text-secondary font-bold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-primary py-4 rounded-xl items-center"
                                onPress={() => {
                                    setShowDepthModal(false);
                                    generateQuestions(true);
                                }}
                            >
                                <Text className="text-white font-bold">Generate</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Fact Modal */}
            <Modal
                visible={!!editingFact}
                transparent
                animationType="fade"
                onRequestClose={() => setEditingFact(null)}
            >
                <View className="flex-1 bg-black/60 justify-center px-6">
                    <View className="bg-background border border-border rounded-2xl p-6 shadow-2xl">
                        <Text className="text-text-tertiary text-xs uppercase font-bold tracking-widest mb-1">
                            Edit Property
                        </Text>
                        <Text className="text-text-primary text-lg font-bold mb-4">
                            {editingFact?.key}
                        </Text>

                        <TextInput
                            className="bg-slate-950 text-text-primary p-4 rounded-xl border border-border min-h-[120px]"
                            multiline
                            textAlignVertical="top"
                            value={editingFact?.value || ''}
                            onChangeText={(text) => setEditingFact(prev => prev ? { ...prev, value: text } : null)}
                            autoFocus
                        />

                        <View className="flex-row gap-3 mt-6">
                            <TouchableOpacity
                                className="flex-1 bg-surface py-4 rounded-xl items-center"
                                onPress={() => setEditingFact(null)}
                            >
                                <Text className="text-text-secondary font-bold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-primary py-4 rounded-xl items-center"
                                onPress={handleSaveEdit}
                            >
                                <Text className="text-white font-bold">Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Fact Modal */}
            <MessageDialog
                visible={isAddingFact}
                onClose={() => setIsAddingFact(false)}
                onSend={async (text) => {
                    try {
                        await addFactFromText(text);
                        setIsAddingFact(false);
                        Toast.show({
                            type: 'success',
                            text1: 'Fact Added',
                            text2: 'Profile updated successfully'
                        });
                    } catch (e) {
                         Toast.show({
                            type: 'error',
                            text1: 'Error',
                            text2: 'Failed to add fact'
                        });
                    }
                }}
                sending={isLoading}
                title="Add New Fact"
                placeholder="Describe a new fact, preference, or trait..."
                sendLabel="Add Fact"
                enableImageAttachment={true}
                imagePrompt="Analyze this image to extract facts, habits, or preferences about the user."
            />

            {/* Full Screen Image Modal - closing tag for Layout below */}
            <Modal
                visible={isImageFull}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setIsImageFull(false);
                    resetGestures();
                }}
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View className="flex-1 bg-black/95 justify-center overflow-hidden">
                        <TouchableOpacity
                            className="absolute top-12 right-6 z-10 p-2 bg-background/50 rounded-full border border-border"
                            onPress={() => {
                                setIsImageFull(false);
                                resetGestures();
                            }}
                        >
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>

                        {profile.profileImage && (
                            <GestureDetector gesture={composedGesture}>
                                <Animated.View style={[animatedStyle, { width: '100%', height: '80%', justifyContent: 'center' }]}>
                                    <Image
                                        source={{ uri: profile.profileImage }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="contain"
                                    />
                                </Animated.View>
                            </GestureDetector>
                        )}

                        <View className="absolute bottom-10 left-0 right-0 items-center">
                            <View className="flex-row gap-4">
                                <TouchableOpacity
                                    className="bg-background px-4 py-3 rounded-full border border-border flex-row items-center gap-2"
                                    onPress={handleShareImage}
                                >
                                    <Ionicons name="share-outline" size={18} color="#818cf8" />
                                    <Text className="text-text-primary font-medium">Share</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="bg-background px-4 py-3 rounded-full border border-border flex-row items-center gap-2"
                                    onPress={handleCopyImage}
                                >
                                    <Ionicons name="copy-outline" size={18} color="#818cf8" />
                                    <Text className="text-text-primary font-medium">Copy</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    className="bg-background px-4 py-3 rounded-full border border-border flex-row items-center gap-2"
                                    onPress={() => {
                                        generateProfileImage();
                                        resetGestures();
                                    }}
                                    disabled={isGeneratingImage}
                                >
                                    <Ionicons name="refresh" size={18} color="#818cf8" />
                                    <Text className="text-text-primary font-medium">Regenerate</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                    </View>
                </GestureHandlerRootView>
            </Modal>
        </Layout>
    );
}
