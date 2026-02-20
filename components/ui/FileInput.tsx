import { View, Text, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
import { useState } from 'react';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { Colors } from './design-tokens';

interface FileInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    vaultUri?: string | null;
    contextRootFolder?: string;
    fileStatus?: 'valid' | 'invalid' | 'neutral';
    onCheckFile?: () => void;
    placeholder?: string;
    fileExtension?: string;
}

export function FileInput({ 
    label, 
    value, 
    onChangeText, 
    vaultUri,
    contextRootFolder,
    fileStatus = 'neutral', 
    onCheckFile,
    placeholder,
    fileExtension = '.md'
}: FileInputProps) {
    const [isSelecting, setIsSelecting] = useState(false);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [files, setFiles] = useState<string[]>([]);

    const handleBrowse = async () => {
        if (!vaultUri) {
            Alert.alert('Vault Required', 'Please select a vault first.');
            return;
        }
        setIsSelecting(true);
        try {
            // Determine the base URI to scan from
            let scanUri = vaultUri;
            if (contextRootFolder && contextRootFolder.trim()) {
                const { checkDirectoryExists } = await import('../../utils/saf');
                const contextUri = await checkDirectoryExists(vaultUri, contextRootFolder.trim());
                if (contextUri) {
                    scanUri = contextUri;
                } else {
                    Alert.alert('Context Root Not Found', `The folder "${contextRootFolder}" does not exist in the vault.`);
                    setIsSelecting(false);
                    return;
                }
            }
            
            // Get list of .md files from the appropriate directory
            const foundFiles = await findMarkdownFiles(scanUri);
            
            if (foundFiles.length === 0) {
                const location = contextRootFolder ? `in "${contextRootFolder}"` : 'in vault';
                Alert.alert('No Files Found', `No ${fileExtension} files found ${location}.`);
                setIsSelecting(false);
                return;
            }

            setFiles(foundFiles);
            setShowFilePicker(true);
            
        } catch (e) {
            console.error('[FileInput] Error browsing files:', e);
            Alert.alert('Error', 'Could not browse files.');
        } finally {
            setIsSelecting(false);
        }
    };

    const handleSelectFile = (filePath: string) => {
        onChangeText(filePath);
        setShowFilePicker(false);
        if (onCheckFile) {
            setTimeout(onCheckFile, 100); // Trigger validation after selection
        }
    };

    return (
        <>
            <View className="mb-4">
                <Text className="text-text-secondary mb-1 ml-1 text-sm font-semibold">{label}</Text>
                <View className="flex-row gap-2">
                    <View className="flex-1 relative">
                        <TextInput 
                            value={value} 
                            onChangeText={onChangeText} 
                            placeholder={placeholder || `Enter ${fileExtension} file path...`}
                            placeholderTextColor={Colors.text.tertiary}
                            className="bg-surface/50 border border-border rounded-xl p-4 pr-12 text-white font-medium"
                        />
                        {fileStatus !== 'neutral' && (
                            <View className="absolute right-0 top-0 bottom-0 px-4 justify-center">
                                <Text className={fileStatus === 'valid' ? "text-success text-lg" : "text-error text-lg"}>
                                    {fileStatus === 'valid' ? '✓' : '✕'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={handleBrowse}
                        disabled={!vaultUri || isSelecting}
                        className={`px-4 py-4 rounded-xl ${!vaultUri || isSelecting ? 'bg-surface-highlight' : 'bg-primary'}`}
                    >
                        <Text className="text-white font-semibold">Browse</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* File Picker Modal */}
            <Modal visible={showFilePicker} transparent animationType="slide">
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-background rounded-t-3xl p-6 max-h-[70%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Select a File</Text>
                            <TouchableOpacity onPress={() => setShowFilePicker(false)}>
                                <Text className="text-white text-2xl">✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {files.map((file) => (
                                <TouchableOpacity
                                    key={file}
                                    onPress={() => handleSelectFile(file)}
                                    className={`p-4 rounded-xl mb-2 ${value === file ? 'bg-primary' : 'bg-surface'}`}
                                >
                                    <Text className="text-white font-medium">{file}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

async function findMarkdownFiles(parentUri: string, relativePath: string = ''): Promise<string[]> {
    const files: string[] = [];
    
    try {
        const children = await StorageAccessFramework.readDirectoryAsync(parentUri);
        
        for (const childUri of children) {
            const decoded = decodeURIComponent(childUri);
            const parts = decoded.split('/');
            const lastPart = parts[parts.length - 1];
            const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;
            
            // Check if it's a directory by trying to read it
            try {
                await StorageAccessFramework.readDirectoryAsync(childUri);
                // It's a directory, recurse
                const subPath = relativePath ? `${relativePath}/${name}` : name;
                const subFiles = await findMarkdownFiles(childUri, subPath);
                files.push(...subFiles);
            } catch {
                // It's a file
                if (name.endsWith('.md')) {
                    const filePath = relativePath ? `${relativePath}/${name}` : name;
                    files.push(filePath);
                }
            }
        }
    } catch (e) {
        console.warn('[findMarkdownFiles] Error reading directory:', e);
    }
    
    return files;
}
