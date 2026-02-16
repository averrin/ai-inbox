import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { listSubdirectories } from '../../utils/saf';

interface FolderInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    vaultUri?: string | null;
    basePath?: string;
    folderStatus?: 'valid' | 'invalid' | 'neutral';
    onCheckFolder?: () => void;
    placeholder?: string;
    compact?: boolean;
}

export function FolderInput({ 
    label, 
    value, 
    onChangeText, 
    vaultUri, 
    basePath,
    folderStatus = 'neutral', 
    onCheckFolder,
    placeholder,
    compact = false
}: FolderInputProps) {
    const [isSelecting, setIsSelecting] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // When basePath is set, the full path is basePath + "/" + value
    // Autocomplete lists subfolders of the full resolved path
    const resolvedPath = basePath
        ? (value ? `${basePath}/${value}` : basePath)
        : value;

    const fetchSuggestions = useCallback(async (fullPath: string) => {
        if (!vaultUri) {
            setSuggestions([]);
            return;
        }

        try {
            const dirs = await listSubdirectories(vaultUri, fullPath);
            setSuggestions(dirs);
            setShowSuggestions(dirs.length > 0);
        } catch {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [vaultUri]);

    useEffect(() => {
        if (!isFocused) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(resolvedPath);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value, isFocused, fetchSuggestions]);

    const handleSelectSuggestion = (subfolder: string) => {
        const newPath = value ? `${value.replace(/\/$/, '')}/${subfolder}` : subfolder;
        onChangeText(newPath);
        // Keep suggestions open — will refresh for the new path
    };

    const handleFocus = () => {
        setIsFocused(true);
        fetchSuggestions(resolvedPath);
    };

    const handleBlur = () => {
        // Delay to allow suggestion tap to register
        setTimeout(() => {
            setIsFocused(false);
            setShowSuggestions(false);
        }, 200);
    };

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
        <View className={compact ? "mb-1" : "mb-4"} style={{ zIndex: 10 }}>
             {!compact && <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">{label}</Text>}
            <View className="flex-row gap-2">
                <View className="flex-1 relative">
                    <View className={`flex-row items-center bg-slate-800/50 border border-slate-700 rounded-xl ${compact ? '' : ''}`}>
                        {basePath ? (
                            <Text className={`text-slate-500 ${compact ? 'pl-3 text-sm' : 'pl-4'} font-medium`}>{basePath}/</Text>
                        ) : null}
                        <TextInput 
                            value={value} 
                            onChangeText={onChangeText} 
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder={placeholder || (basePath ? 'subfolder...' : 'Enter folder path...')}
                            placeholderTextColor="#94a3b8"
                            className={`flex-1 ${compact ? 'p-3 text-sm' : 'p-4'} ${basePath ? 'pl-0.5' : ''} pr-12 text-white font-medium`}
                        />
                    </View>
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
                    className={`px-4 ${compact ? 'py-3' : 'py-4'} rounded-xl ${!vaultUri || isSelecting ? 'bg-slate-700' : 'bg-indigo-600'}`}
                >
                    <Text className="text-white font-semibold">Browse</Text>
                </TouchableOpacity>
            </View>
            {showSuggestions && suggestions.length > 0 && (
                <ScrollView 
                    className="bg-slate-800 border border-slate-600 rounded-xl mt-1"
                    style={{ maxHeight: 150 }}
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                >
                    {suggestions.map((dir) => (
                        <TouchableOpacity
                            key={dir}
                            onPress={() => handleSelectSuggestion(dir)}
                            className="px-3 py-2.5 border-b border-slate-700/50 flex-row items-center"
                        >
                            <Text className="text-indigo-400 mr-2">📁</Text>
                            <Text className="text-white text-sm font-medium">{dir}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}
