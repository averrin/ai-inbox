import { View, Text, Alert, TouchableOpacity, Modal, ScrollView, BackHandler, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from './ui/Layout';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { useSettingsStore } from '../store/settings';
import { requestVaultAccess } from '../utils/saf';
import { fetchAvailableModels } from '../services/models';
import { useState, useEffect, useRef } from 'react';
import { FolderInput } from './ui/FolderInput';
import { FileInput } from './ui/FileInput';
import { openInObsidian } from '../utils/obsidian';
import { GoogleSettings } from './GoogleSettings';
import { RemindersSettings } from './RemindersSettings';
import { CalendarsSettings } from './CalendarsSettings';
import { EventTypesSettings } from './EventTypesSettings';
import { TimeRangesSettings } from './TimeRangesSettings';
import { LunchSettings } from './LunchSettings';
import { WeatherSettings } from './WeatherSettings';
import { MoodSettings } from './MoodSettings';
import { HabitSettings } from './HabitSettings';
import { TasksSettings } from './TasksSettings';
import { TagPropertySettings } from './TagPropertySettings';
import { ContactsSettings } from './ContactsSettings';
import { scanForReminders } from '../services/reminderService';
import { useEventTypesStore } from '../store/eventTypes';
import Toast from 'react-native-toast-message';
import { generateDebugSnapshot } from '../utils/debugUtils';

type SettingsSection = 'root' | 'general' | 'calendars' | 'event-types' | 'time-ranges' | 'habits' | 'google-calendar' | 'reminders' | 'tasks' | 'tag-property' | 'contacts' | 'weather' | 'mood' | 'advanced';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function SetupScreen({ onClose, canClose }: { onClose?: () => void, canClose?: boolean }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel, contextRootFolder, setApiKey, setVaultUri, setCustomPromptPath, setSelectedModel, setContextRootFolder, googleAndroidClientId, googleIosClientId, googleWebClientId, setGoogleAndroidClientId, setGoogleIosClientId, setGoogleWebClientId, timeFormat, setTimeFormat, editorType, setEditorType } = useSettingsStore();
    const [keyInput, setKeyInput] = useState(apiKey || '');
    const [androidIdInput, setAndroidIdInput] = useState(googleAndroidClientId || '');
    const [promptPathInput, setPromptPathInput] = useState(customPromptPath || '');
    const [modelInput, setModelInput] = useState(selectedModel);
    const [rootFolderInput, setRootFolderInput] = useState(contextRootFolder || '');
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.0-flash-exp']);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    const [promptFileStatus, setPromptFileStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    const [showLunchSettings, setShowLunchSettings] = useState(false);
    const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState(false);

    // Navigation state for settings mode
    const [activeSection, setActiveSection] = useState<SettingsSection>('root');

    // Animation state
    const slideAnim = useRef(new Animated.Value(0)).current;

    // Determine current level for animation
    const getLevel = (section: SettingsSection) => {
        if (section === 'root') return 0;
        return 1;
    };

    // Effect to trigger animation when section changes
    useEffect(() => {
        const targetLevel = getLevel(activeSection);
        Animated.spring(slideAnim, {
            toValue: targetLevel,
            useNativeDriver: true,
            friction: 8,
            tension: 40
        }).start();
    }, [activeSection]);


    // Handle back button behavior for internal navigation
    useEffect(() => {
        if (!canClose) return;

        const backAction = () => {
            const currentLevel = getLevel(activeSection);
            if (currentLevel === 1) {
                setActiveSection('root');
                return true;
            }
            if (currentLevel === 0 && onClose) {
                onClose();
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [activeSection, canClose, onClose]);

    // Fetch models when API key changes
    useEffect(() => {
        if (keyInput && keyInput.length > 30) {
            fetchAvailableModels(keyInput).then(setAvailableModels);
        }
    }, [keyInput]);

    // Check folder validity
    const checkFolder = async () => {
        if (!vaultUri || !rootFolderInput) {
            setFolderStatus('neutral');
            return;
        }
        const { checkDirectoryExists } = await import('../utils/saf');
        const exists = await checkDirectoryExists(vaultUri, rootFolderInput);
        setFolderStatus(exists ? 'valid' : 'invalid');
    };

    // Reactive folder validation
    useEffect(() => {
        if (!vaultUri || !rootFolderInput) {
            setFolderStatus('neutral');
            return;
        }

        const timer = setTimeout(() => {
            checkFolder();
        }, 500); // Debounce 500ms

        return () => clearTimeout(timer);
    }, [rootFolderInput, vaultUri]);

    // Check prompt file validity
    const checkPromptFile = async () => {
        if (!vaultUri || !promptPathInput) {
            setPromptFileStatus('neutral');
            return;
        }

        const { checkDirectoryExists, checkFileExists } = await import('../utils/saf');

        // Determine base URI to check from
        let baseUri = vaultUri;
        if (rootFolderInput && rootFolderInput.trim()) {
            const contextUri = await checkDirectoryExists(vaultUri, rootFolderInput.trim());
            if (contextUri) {
                baseUri = contextUri;
            }
        }

        const exists = await checkFileExists(baseUri, promptPathInput);
        setPromptFileStatus(exists ? 'valid' : 'invalid');
    };

    // Reactive prompt file validation
    useEffect(() => {
        if (!vaultUri || !promptPathInput) {
            setPromptFileStatus('neutral');
            return;
        }

        const timer = setTimeout(() => {
            checkPromptFile();
        }, 500); // Debounce 500ms

        return () => clearTimeout(timer);
    }, [promptPathInput, vaultUri, rootFolderInput]);

    const handlePickVault = async () => {
        const uri = await requestVaultAccess();
        if (uri) {
            setVaultUri(uri);
        } else {
            Alert.alert("Permission Required", "Please select a folder to save your notes.");
        }
    };

    const handleSave = () => {
        if (!keyInput.trim()) {
            Alert.alert("Missing API Key", "Please enter your Google Gemini API Key.");
            return;
        }
        if (!vaultUri) {
            Alert.alert("Missing Vault", "Please select a vault folder.");
            return;
        }
        setApiKey(keyInput);
        setCustomPromptPath(promptPathInput);
        setSelectedModel(modelInput);
        setContextRootFolder(rootFolderInput);
        setGoogleAndroidClientId(androidIdInput);
        if (onClose) onClose();
    };

    // Auto-save effect (Only in Settings mode)
    useEffect(() => {
        if (!canClose) return; // Don't auto-save in Welcome mode

        const timer = setTimeout(() => {
            setApiKey(keyInput);
            setCustomPromptPath(promptPathInput);
            setSelectedModel(modelInput);
            setContextRootFolder(rootFolderInput);
            setGoogleAndroidClientId(androidIdInput);
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [
        canClose,
        keyInput,
        promptPathInput,
        modelInput,
        rootFolderInput,
        androidIdInput,
        setApiKey,
        setCustomPromptPath,
        setSelectedModel,
        setContextRootFolder,
        setGoogleAndroidClientId,
    ]);

    const renderHeader = (title: string, onBack: (() => void) | undefined) => (
        <View className="flex-row items-center px-4 pt-4 pb-2">
            {onBack && (
                <TouchableOpacity onPress={onBack} className="p-2 mr-2">
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
            )}
            <Text className="text-2xl font-bold text-white">{title}</Text>
        </View>
    );

    const renderGeneralSettings = () => (
        <Card>
            <Input
                label="Gemini API Key"
                value={keyInput}
                onChangeText={setKeyInput}
                placeholder="AIza..."
            />

            <View className="mb-4">
                <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">AI Model</Text>
                <TouchableOpacity
                    onPress={() => setShowModelPicker(true)}
                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4"
                >
                    <Text className="text-white font-medium">{modelInput}</Text>
                </TouchableOpacity>
            </View>

            <View className="mb-4">
                <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">Obsidian Vault</Text>
                <View className="flex-row gap-2">
                    <View className="flex-1">
                        {vaultUri ? (
                            <Text className="text-green-400 bg-green-900/20 p-4 rounded-xl overflow-hidden border border-slate-700" numberOfLines={1}>
                                {(() => {
                                    // Extract human-readable path from SAF URI
                                    const decoded = decodeURIComponent(vaultUri);
                                    // Extract the path after "tree/" or "document/"
                                    const pathMatch = decoded.match(/(?:tree|document)\/(.+?)$/);
                                    if (pathMatch && pathMatch[1]) {
                                        // Decode the encoded path and extract the readable part
                                        const encodedPath = pathMatch[1];
                                        // Handle formats like "primary:Documents/Vault"
                                        const readablePath = encodedPath.replace(/primary:/, 'Internal Storage/');
                                        return readablePath;
                                    }
                                    return decoded;
                                })()}
                            </Text>
                        ) : (
                            <Text className="text-slate-500 italic p-4 bg-slate-800/50 border border-slate-700 rounded-xl">No vault selected</Text>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={handlePickVault}
                        className="px-4 py-4 rounded-xl bg-indigo-600"
                    >
                        <Text className="text-white font-semibold">{vaultUri ? "Change" : "Select"}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FolderInput
                label="Context Root Folder (Optional)"
                value={rootFolderInput}
                onChangeText={setRootFolderInput}
                vaultUri={vaultUri}
                folderStatus={folderStatus}
                onCheckFolder={checkFolder}
                placeholder="e.g., Inbox (leave empty for vault root)"
            />

            <FileInput
                label="Custom Prompt File (Optional)"
                value={promptPathInput}
                onChangeText={setPromptPathInput}
                vaultUri={vaultUri}
                contextRootFolder={rootFolderInput}
                fileStatus={promptFileStatus}
                onCheckFile={checkPromptFile}
                placeholder="e.g., ai-prompt.md"
                fileExtension=".md"
            />

            {/* Open in Obsidian button */}
            {promptPathInput && promptFileStatus === 'valid' && vaultUri && (
                <View className="mt-2 mb-4">
                    <Button
                        title="📝 Open Prompt File in Obsidian"
                        onPress={async () => {
                            if (!promptPathInput || !vaultUri) return;
                            
                            // Determine full file URI
                            const { findFile, findSubdirectory } = await import('../utils/saf');
                            let baseUri = vaultUri;
                            if (rootFolderInput && rootFolderInput.trim()) {
                                const contextUri = await findSubdirectory(vaultUri, rootFolderInput.trim());
                                if (contextUri) baseUri = contextUri;
                            }
                            
                            // Reresolve parts if nesting
                            let targetDirUri = baseUri;
                            let filename = promptPathInput;
                            if (promptPathInput.includes('/')) {
                                const parts = promptPathInput.split('/').filter(p => p.trim());
                                filename = parts.pop()!;
                                if (parts.length > 0) {
                                    const subDir = await findSubdirectory(baseUri, parts.join('/'));
                                    if (subDir) targetDirUri = subDir;
                                }
                            }

                            const fullFilePath = await findFile(targetDirUri, filename);
                            if (fullFilePath) {
                                await openInObsidian(vaultUri, fullFilePath);
                            } else {
                                Alert.alert("Error", "Could not resolve prompt file path");
                            }
                        }}
                        variant="secondary"
                    />
                </View>
            )}

            <View className="mt-2 mb-2 pt-4 border-t border-slate-700">
                <Text className="text-indigo-200 mb-2 font-semibold">Preferences</Text>
                <TouchableOpacity
                    onPress={() => setTimeFormat(timeFormat === '24h' ? '12h' : '24h')}
                    className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                >
                    <View className="flex-row items-center flex-1">
                        <Ionicons name="time-outline" size={20} color="#818cf8" />
                        <View className="ml-3 flex-1">
                            <Text className="text-white font-medium">Time Format</Text>
                            <Text className="text-slate-400 text-xs text-uppercase">{timeFormat} Format</Text>
                        </View>
                    </View>
                    <View className="bg-slate-700 rounded-lg flex-row p-1">
                        <View className={`px-2 py-1 rounded-md ${timeFormat === '12h' ? 'bg-indigo-600' : ''}`}>
                            <Text className="text-white text-xs font-bold">12H</Text>
                        </View>
                        <View className={`px-2 py-1 rounded-md ${timeFormat === '24h' ? 'bg-indigo-600' : ''}`}>
                            <Text className="text-white text-xs font-bold">24H</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setEditorType(editorType === 'rich' ? 'simple' : 'rich')}
                    className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between mt-2"
                >
                    <View className="flex-row items-center flex-1">
                        <Ionicons name="text-outline" size={20} color="#818cf8" />
                        <View className="ml-3 flex-1">
                            <Text className="text-white font-medium">Text Editor</Text>
                            <Text className="text-slate-400 text-xs">Use classic editor if experiencing issues</Text>
                        </View>
                    </View>
                    <View className="bg-slate-700 rounded-lg flex-row p-1">
                        <View className={`px-2 py-1 rounded-md ${editorType === 'rich' ? 'bg-indigo-600' : ''}`}>
                            <Text className="text-white text-xs font-bold">Rich</Text>
                        </View>
                        <View className={`px-2 py-1 rounded-md ${editorType === 'simple' ? 'bg-indigo-600' : ''}`}>
                            <Text className="text-white text-xs font-bold">Simple</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </View>
        </Card>
    );

    const renderGoogleCalendarSettings = () => (
        <Card>
            <View className="mb-4">
                <Text className="text-indigo-200 mb-2 font-semibold">Configuration</Text>
                <Input
                    label="Android Client ID"
                    value={androidIdInput}
                    onChangeText={setAndroidIdInput}
                    placeholder="...apps.googleusercontent.com"
                />
            </View>

            <View className="border-t border-slate-700 pt-4">
                <Text className="text-indigo-200 mb-2 font-semibold">Account Status</Text>
                <GoogleSettings
                    androidClientId={androidIdInput}
                />
            </View>
        </Card>
    );

    const renderAdvancedSettings = () => (
        <Card>
             <View className="mb-4">
                <Text className="text-indigo-200 mb-2 font-semibold">Data Management</Text>
                <Text className="text-slate-400 text-sm mb-4">
                    Clear locally cached data (reminders, event types). This does not delete any files from your vault, but forces a reload from disk.
                </Text>
                <Button
                    title="Flush All Local Caches"
                    onPress={async () => {
                        try {
                            // 1. Clear Reminders Cache
                            useSettingsStore.getState().setCachedReminders([]);

                            // 2. Refresh Reminders
                            await scanForReminders();

                            // 3. Reload Event Types
                            await useEventTypesStore.getState().loadConfig();

                            Toast.show({
                                type: 'success',
                                text1: 'Caches Flushed',
                                text2: 'Local data has been refreshed from vault.'
                            });
                        } catch (e) {
                            console.error(e);
                            Toast.show({
                                type: 'error',
                                text1: 'Failed to flush caches',
                                text2: 'Check logs for details.'
                            });
                        }
                    }}
                    variant="secondary"
                />

                <View className="mt-6 mb-2 pt-4 border-t border-slate-700">
                    <Text className="text-indigo-200 mb-2 font-semibold">Debug Tools</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Export a snapshot of all internal application state (settings, event types, moods, habits, etc.) to a JSON file for debugging.
                    </Text>
                    <Button
                        title={isGeneratingSnapshot ? "Generating..." : "Export State Snapshot"}
                        onPress={async () => {
                            if (isGeneratingSnapshot) return;
                            setIsGeneratingSnapshot(true);
                            try {
                                await generateDebugSnapshot();
                            } catch (e) {
                                console.error(e);
                                Toast.show({
                                    type: 'error',
                                    text1: 'Snapshot Failed',
                                    text2: 'Check logs for details.'
                                });
                            } finally {
                                setIsGeneratingSnapshot(false);
                            }
                        }}
                        variant="secondary"
                    />
                </View>
            </View>
        </Card>
    );

    const renderMenuButton = (title: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, subtitle?: string) => (
        <TouchableOpacity
            onPress={onPress}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-2 flex-row items-center justify-between"
        >
            <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-slate-700 items-center justify-center mr-3">
                    <Ionicons name={icon} size={20} color="#818cf8" />
                </View>
                <View>
                    <Text className="text-white font-semibold text-lg">{title}</Text>
                    {subtitle && <Text className="text-slate-400 text-sm">{subtitle}</Text>}
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
    );

    const renderRootMenu = () => (
        <View className="px-4 mt-2">
            {renderMenuButton(
                "General",
                "settings-outline",
                () => setActiveSection('general'),
                "API Keys, Vault, Model"
            )}
            {renderMenuButton(
                "Calendars",
                "calendar-outline",
                () => setActiveSection('calendars'),
                "Manage connected calendars"
            )}
            {renderMenuButton(
                "Event Types",
                "pricetag-outline",
                () => setActiveSection('event-types'),
                "Configure event categories"
            )}
            {renderMenuButton(
                "Time Ranges",
                "time-outline",
                () => setActiveSection('time-ranges'),
                "Recurring calendar blocks"
            )}
            {renderMenuButton(
                "Lunch Settings",
                "restaurant-outline",
                () => setShowLunchSettings(true),
                "Lunch scheduling & defaults"
            )}
            {renderMenuButton(
                "Checks",
                "checkmark-circle-outline",
                () => setActiveSection('habits'),
                "Tracking daily habits"
            )}
            {renderMenuButton(
                "Mood Tracker",
                "happy-outline",
                () => setActiveSection('mood'),
                "Daily evaluation & reflections"
            )}
            {renderMenuButton(
                "Google Integration",
                "logo-google",
                () => setActiveSection('google-calendar'),
                "Client IDs & Account"
            )}
            {renderMenuButton(
                "Tasks Dashboard",
                "list-outline",
                () => setActiveSection('tasks'),
                "Configure task aggregation"
            )}
            {renderMenuButton(
                "Tags & Properties",
                "pricetags-outline",
                () => setActiveSection('tag-property'),
                "Visibility & Colors"
            )}
            {renderMenuButton(
                "Contacts & Attendees",
                "people-outline",
                () => setActiveSection('contacts'),
                "My emails, contacts, auto-typing"
            )}
            {renderMenuButton(
                "Reminders",
                "alarm-outline",
                () => setActiveSection('reminders'),
                "Local notifications"
            )}
            {renderMenuButton(
                "Weather",
                "cloud-outline",
                () => setActiveSection('weather'),
                "Location & Preferences"
            )}
             {renderMenuButton(
                "Advanced",
                "construct-outline",
                () => setActiveSection('advanced'),
                "Debug & Cache tools"
            )}
        </View>
    );

    // If welcome mode, show everything in one list (simplified for initial setup)
    const renderWelcomeContent = () => (
        <View>
            <View className="justify-center mt-10 mb-8">
                <Text className="text-3xl font-bold text-white mb-2 text-center">Welcome</Text>
                <Text className="text-indigo-200 text-center">Setup your AI Inbox</Text>
            </View>
            {renderGeneralSettings()}
            <View className="h-4" />
            <View className="px-4">
                <Text className="text-xl font-bold text-white mb-2">Integrations</Text>
            </View>
            {renderGoogleCalendarSettings()}

            <View className="mt-8 mb-8 px-4">
                <Button title="Save & Continue" onPress={handleSave} disabled={!keyInput || !vaultUri} />
            </View>
        </View>
    );

    // Animation Interpolations
    const rootTranslateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -SCREEN_WIDTH],
        extrapolate: 'clamp',
    });

    const rootOpacity = slideAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
    });

    const level1TranslateX = slideAnim.interpolate({
        inputRange: [0, 1, 2],
        outputRange: [SCREEN_WIDTH, 0, -SCREEN_WIDTH],
        extrapolate: 'clamp',
    });

    const level1Opacity = slideAnim.interpolate({
        inputRange: [0, 0.5, 1, 1.5, 2],
        outputRange: [0, 0, 1, 0, 0],
        extrapolate: 'clamp',
    });

    const level2TranslateX = slideAnim.interpolate({
        inputRange: [1, 2],
        outputRange: [SCREEN_WIDTH, 0],
        extrapolate: 'clamp',
    });

    const level2Opacity = slideAnim.interpolate({
        inputRange: [1, 1.5, 2],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
    });


    // If canClose is false, we are in initial setup, so no fancy animations needed (or just render standard)
    if (!canClose) {
        return (
            <Layout>
                <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="always">
                    {renderWelcomeContent()}
                </ScrollView>
                {/* Modals ... */}
                <Modal visible={showModelPicker} transparent animationType="slide">
                    <View className="flex-1 justify-end bg-black/50">
                        <View className="bg-slate-900 rounded-t-3xl p-6 max-h-[70%]">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-white text-xl font-bold">Select AI Model</Text>
                                <TouchableOpacity onPress={() => setShowModelPicker(false)}>
                                    <Ionicons name="close" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {availableModels.map((model) => (
                                    <TouchableOpacity
                                        key={model}
                                        onPress={() => {
                                            setModelInput(model);
                                            setShowModelPicker(false);
                                        }}
                                        className={`p-4 rounded-xl mb-2 ${modelInput === model ? 'bg-indigo-600' : 'bg-slate-800'}`}
                                    >
                                        <Text className="text-white font-medium">{model}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </Layout>
        );
    }

    return (
        <Layout>
            <View className="flex-1 relative overflow-hidden">
                {/* Level 0: Root */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0, bottom: 0, left: 0, right: 0,
                        transform: [{ translateX: rootTranslateX }],
                        zIndex: 0
                    }}
                    pointerEvents={activeSection === 'root' ? 'auto' : 'none'}
                >
                    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="always">
                        {renderHeader("Settings", onClose)}
                        {renderRootMenu()}
                    </ScrollView>
                </Animated.View>

                {/* Level 1: Detail Views */}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0, bottom: 0, left: 0, right: 0,
                        transform: [{ translateX: level1TranslateX }],
                        zIndex: 1
                    }}
                    pointerEvents={activeSection !== 'root' ? 'auto' : 'none'}
                >
                    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="always">
                        {activeSection === 'general' && (
                            <>
                                {renderHeader("General", () => setActiveSection('root'))}
                                <View className="px-0">{renderGeneralSettings()}</View>
                            </>
                        )}
                        {activeSection === 'calendars' && (
                            <>
                                {renderHeader("Calendars", () => setActiveSection('root'))}
                                <View className="px-0"><CalendarsSettings /></View>
                            </>
                        )}
                        {activeSection === 'event-types' && (
                            <>
                                {renderHeader("Event Types", () => setActiveSection('root'))}
                                <View className="px-0"><EventTypesSettings /></View>
                            </>
                        )}
                        {activeSection === 'time-ranges' && (
                            <>
                                {renderHeader("Time Ranges", () => setActiveSection('root'))}
                                <View className="px-0"><TimeRangesSettings /></View>
                            </>
                        )}
                        {activeSection === 'habits' && (
                            <>
                                {renderHeader("Checks", () => setActiveSection('root'))}
                                <View className="px-0"><HabitSettings /></View>
                            </>
                        )}
                        {activeSection === 'google-calendar' && (
                            <>
                                {renderHeader("Google Integration", () => setActiveSection('root'))}
                                <View className="px-0">{renderGoogleCalendarSettings()}</View>
                            </>
                        )}
                        {activeSection === 'tasks' && (
                            <>
                                {renderHeader("Tasks Configuration", () => setActiveSection('root'))}
                                <View className="px-0"><TasksSettings /></View>
                            </>
                        )}
                        {activeSection === 'tag-property' && (
                            <>
                                {renderHeader("Tags & Properties", () => setActiveSection('root'))}
                                <View className="px-0"><TagPropertySettings /></View>
                            </>
                        )}
                        {activeSection === 'contacts' && (
                            <>
                                {renderHeader("Contacts & Attendees", () => setActiveSection('root'))}
                                <View className="px-0"><ContactsSettings /></View>
                            </>
                        )}
                        {activeSection === 'reminders' && (
                            <>
                                {renderHeader("Reminders", () => setActiveSection('root'))}
                                <View className="px-0"><RemindersSettings /></View>
                            </>
                        )}
                        {activeSection === 'weather' && (
                            <>
                                {renderHeader("Weather", () => setActiveSection('root'))}
                                <View className="px-0"><WeatherSettings /></View>
                            </>
                        )}
                        {activeSection === 'mood' && (
                            <>
                                {renderHeader("Mood Tracker", () => setActiveSection('root'))}
                                <View className="px-0"><MoodSettings /></View>
                            </>
                        )}
                        {activeSection === 'advanced' && (
                            <>
                                {renderHeader("Advanced", () => setActiveSection('root'))}
                                <View className="px-0">{renderAdvancedSettings()}</View>
                            </>
                        )}
                    </ScrollView>
                </Animated.View>

            </View>

            {/* Model Selection Modal */}
            <Modal visible={showModelPicker} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-slate-900 rounded-t-3xl p-6 max-h-[70%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Select AI Model</Text>
                            <TouchableOpacity onPress={() => setShowModelPicker(false)}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {availableModels.map((model) => (
                                <TouchableOpacity
                                    key={model}
                                    onPress={() => {
                                        setModelInput(model);
                                        setShowModelPicker(false);
                                    }}
                                    className={`p-4 rounded-xl mb-2 ${modelInput === model ? 'bg-indigo-600' : 'bg-slate-800'}`}
                                >
                                    <Text className="text-white font-medium">{model}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <LunchSettings visible={showLunchSettings} onClose={() => setShowLunchSettings(false)} />
        </Layout>
    );
}
