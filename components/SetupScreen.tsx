import { View, Text, Alert, TouchableOpacity, Modal, ScrollView } from 'react-native';
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

export default function SetupScreen({ onClose, canClose }: { onClose?: () => void, canClose?: boolean }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel, contextRootFolder, setApiKey, setVaultUri, setCustomPromptPath, setSelectedModel, setContextRootFolder } = useSettingsStore();
    const [keyInput, setKeyInput] = useState(apiKey || '');
    const [promptPathInput, setPromptPathInput] = useState(customPromptPath || '');
    const [modelInput, setModelInput] = useState(selectedModel);
    const [rootFolderInput, setRootFolderInput] = useState(contextRootFolder || '');
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.0-flash-exp']);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    const [promptFileStatus, setPromptFileStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

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
        if (onClose) onClose();
    };

    return (
        <Layout>
            <View className="flex-1 justify-center">
                <Text className="text-3xl font-bold text-white mb-2 text-center">Welcome</Text>
                <Text className="text-indigo-200 text-center mb-8">Setup your AI Inbox</Text>

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
                                    
                                    try {
                                        // Build relative path from context root
                                        const relativePath = rootFolderInput 
                                            ? `${rootFolderInput}/${promptPathInput}` 
                                            : promptPathInput;
                                        
                                        const obsidianUrl = `obsidian://open?path=${encodeURIComponent(relativePath)}`;
                                        console.log('[SetupScreen] Opening prompt file:', obsidianUrl);
                                        
                                        const Linking = await import('expo-linking');
                                        await Linking.openURL(obsidianUrl);
                                    } catch (e) {
                                        console.error('[SetupScreen] Failed to open in Obsidian:', e);
                                        Alert.alert('Error', 'Could not open file in Obsidian');
                                    }
                                }} 
                                variant="secondary" 
                            />
                        </View>
                    )}
                </Card>

                <View className="mt-8">
                     <Button title={canClose ? "Save & Close" : "Save & Continue"} onPress={handleSave} disabled={!keyInput || !vaultUri} />
                     {canClose && (
                        <View className="mt-4">
                            <Button title="Cancel" onPress={() => onClose && onClose()} variant="secondary" />
                        </View>
                     )}
                </View>
            </View>

            {/* Model Selection Modal */}
            <Modal visible={showModelPicker} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-slate-900 rounded-t-3xl p-6 max-h-[70%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Select AI Model</Text>
                            <TouchableOpacity onPress={() => setShowModelPicker(false)}>
                                <Text className="text-white text-2xl">✕</Text>
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
