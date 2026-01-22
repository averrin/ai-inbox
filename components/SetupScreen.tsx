import { View, Text, Alert, TouchableOpacity, Modal, ScrollView, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Layout } from './ui/Layout';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { useSettingsStore } from '../store/settings';
import { requestVaultAccess } from '../utils/saf';
import { fetchAvailableModels } from '../services/models';
import { useState, useEffect } from 'react';
import { FolderInput } from './ui/FolderInput';
import { FileInput } from './ui/FileInput';
import { openInObsidian } from '../utils/obsidian';
import { GoogleSettings } from './GoogleSettings';
import { RemindersSettings } from './RemindersSettings';

type SettingsSection = 'root' | 'general' | 'connections' | 'google-calendar' | 'reminders';

export default function SetupScreen({ onClose, canClose }: { onClose?: () => void, canClose?: boolean }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel, contextRootFolder, setApiKey, setVaultUri, setCustomPromptPath, setSelectedModel, setContextRootFolder, googleAndroidClientId, googleIosClientId, googleWebClientId, setGoogleAndroidClientId, setGoogleIosClientId, setGoogleWebClientId } = useSettingsStore();
    const [keyInput, setKeyInput] = useState(apiKey || '');
    const [androidIdInput, setAndroidIdInput] = useState(googleAndroidClientId || '');
    const [promptPathInput, setPromptPathInput] = useState(customPromptPath || '');
    const [modelInput, setModelInput] = useState(selectedModel);
    const [rootFolderInput, setRootFolderInput] = useState(contextRootFolder || '');
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.0-flash-exp']);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    const [promptFileStatus, setPromptFileStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

    // Navigation state for settings mode
    const [activeSection, setActiveSection] = useState<SettingsSection>('root');

    // Handle back button behavior for internal navigation
    useEffect(() => {
        if (!canClose) return;

        const backAction = () => {
            if (activeSection === 'google-calendar' || activeSection === 'reminders') {
                setActiveSection('connections');
                return true;
            }
            if (activeSection === 'connections' || activeSection === 'general') {
                setActiveSection('root');
                return true;
            }
            if (activeSection === 'root' && onClose) {
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

    const renderHeader = () => {
        if (!canClose) {
            return (
                <View className="justify-center mt-10 mb-8">
                    <Text className="text-3xl font-bold text-white mb-2 text-center">Welcome</Text>
                    <Text className="text-indigo-200 text-center">Setup your AI Inbox</Text>
                </View>
            );
        }

        let title = "Settings";
        let onBack = onClose;

        if (activeSection === 'general') {
            title = "General";
            onBack = () => setActiveSection('root');
        } else if (activeSection === 'connections') {
            title = "Connections";
            onBack = () => setActiveSection('root');
        } else if (activeSection === 'google-calendar') {
            title = "Google Calendar";
            onBack = () => setActiveSection('connections');
        } else if (activeSection === 'reminders') {
            title = "Reminders";
            onBack = () => setActiveSection('connections');
        }

        return (
            <View className="flex-row items-center px-4 pt-4 pb-2">
                <TouchableOpacity onPress={onBack} className="p-2 mr-2">
                     <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-white">{title}</Text>
            </View>
        );
    };

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
            {promptPathInput && promptFileStatus === 'valid' && (
                <View className="mt-2 mb-4">
                    <Button
                        title="📝 Open Prompt File in Obsidian"
                        onPress={async () => {
                            if (!promptPathInput) return;
                            await openInObsidian(promptPathInput, rootFolderInput);
                        }}
                        variant="secondary"
                    />
                </View>
            )}
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

    const renderMenuButton = (title: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, subtitle?: string) => (
        <TouchableOpacity
            onPress={onPress}
            className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-3 flex-row items-center justify-between"
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
                "Connections",
                "link-outline",
                () => setActiveSection('connections'),
                "Google Calendar, External Apps"
            )}
        </View>
    );

    const renderConnectionsMenu = () => (
        <View className="px-4 mt-2">
            {renderMenuButton(
                "Google Calendar",
                "calendar-outline",
                () => setActiveSection('google-calendar'),
                "Schedule events from notes"
            )}
            {renderMenuButton(
                "Reminders",
                "alarm-outline",
                () => setActiveSection('reminders'),
                "Local notifications from notes"
            )}
        </View>
    );

    // If welcome mode, show everything in one list (simplified for initial setup)
    // Or we can just reuse the General Settings block + Google Calendar block if we want to be consistent?
    // Let's keep the original "everything in one" for Welcome mode to ensure they don't miss steps.
    const renderWelcomeContent = () => (
        <View>
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

    return (
        <Layout>
            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                {renderHeader()}

                {/* Content Rendering Logic */}
                {!canClose ? (
                    renderWelcomeContent()
                ) : (
                    <View>
                        {activeSection === 'root' && renderRootMenu()}
                        {activeSection === 'general' && <View className="px-0">{renderGeneralSettings()}</View>}
                        {activeSection === 'connections' && renderConnectionsMenu()}
                        {activeSection === 'google-calendar' && <View className="px-0">{renderGoogleCalendarSettings()}</View>}
                        {activeSection === 'reminders' && <View className="px-0"><RemindersSettings /></View>}
                    </View>
                )}
            </ScrollView>

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
        </Layout>
    );
}
