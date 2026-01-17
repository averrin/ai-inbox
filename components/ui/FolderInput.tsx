import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { useState } from 'react';
import { StorageAccessFramework } from 'expo-file-system/legacy';

interface FolderInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    vaultUri?: string | null;
    folderStatus?: 'valid' | 'invalid' | 'neutral';
    onCheckFolder?: () => void;
    placeholder?: string;
}

export function FolderInput({ 
    label, 
    value, 
    onChangeText, 
    vaultUri, 
    folderStatus = 'neutral', 
    onCheckFolder,
    placeholder 
}: FolderInputProps) {
    const [isSelecting, setIsSelecting] = useState(false);

    const handleBrowse = async () => {
        if (!vaultUri) return;
        setIsSelecting(true);
        try {
            // Request directory picker starting from vault
            const result = await StorageAccessFramework.requestDirectoryPermissionsAsync(vaultUri);
            
            if (result.granted && result.directoryUri) {
                // Extract relative path from the selected folder URI
                const vaultDecoded = decodeURIComponent(vaultUri);
                const selectedDecoded = decodeURIComponent(result.directoryUri);
                
                // Try to extract relative path
                // Vault: content://.../tree/primary:Documents/Vault
                // Selected: content://.../tree/primary:Documents/Vault/Inbox/URLs
                
                const vaultMatch = vaultDecoded.match(/(?:tree|document)\/(.+?)$/);
                const selectedMatch = selectedDecoded.match(/(?:tree|document)\/(.+?)$/);
                
                if (vaultMatch && selectedMatch) {
                    const vaultPath = vaultMatch[1];
                    const selectedPath = selectedMatch[1];
                    
                    // Remove vault path prefix to get relative path
                    if (selectedPath.startsWith(vaultPath)) {
                        let relativePath = selectedPath.substring(vaultPath.length);
                        // Remove leading slash if present
                        relativePath = relativePath.replace(/^\//, '');
                        onChangeText(relativePath);
                        console.log('[FolderInput] Set relative path:', relativePath);
                    } else {
                        console.warn('[FolderInput] Selected folder is not within vault');
                    }
                }
            }
        } catch (e) {
            console.error('[FolderInput] Error selecting folder:', e);
        } finally {
            setIsSelecting(false);
        }
    };

    return (
        <View className="mb-4">
            <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">{label}</Text>
            <View className="flex-row gap-2">
                <View className="flex-1 relative">
                    <TextInput 
                        value={value} 
                        onChangeText={onChangeText} 
                        placeholder={placeholder || 'Enter folder path...'}
                        placeholderTextColor="#94a3b8"
                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 pr-12 text-white font-medium"
                    />
                    {onCheckFolder && (
                        <TouchableOpacity 
                            onPress={onCheckFolder} 
                            className="absolute right-0 top-0 bottom-0 px-4 justify-center"
                        >
                            <Text className={folderStatus === 'valid' ? "text-green-400 text-lg" : folderStatus === 'invalid' ? "text-orange-400 text-lg" : "text-slate-400 text-lg"}>
                                {folderStatus === 'valid' ? '✓' : folderStatus === 'invalid' ? '+' : '🔍'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    onPress={handleBrowse}
                    disabled={!vaultUri || isSelecting}
                    className={`px-4 py-4 rounded-xl ${!vaultUri || isSelecting ? 'bg-slate-700' : 'bg-indigo-600'}`}
                >
                    <Text className="text-white font-semibold">Browse</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
