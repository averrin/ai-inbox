import { View, Text, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { listSubdirectories } from '../../utils/saf';
import { getSuggestions, applySuggestion, resolveBrowsePath } from '../../utils/folderUtils';
import { Colors } from './design-tokens';

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
    const [completionMode, setCompletionMode] = useState<'append' | 'replace'>('append');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<TextInput>(null);

    const fetchSuggestions = useCallback(async (currentInput: string) => {
        if (!vaultUri) {
            setSuggestions([]);
            return;
        }

        try {
            const { suggestions: dirs, mode } = await getSuggestions(
                vaultUri,
                basePath,
                currentInput,
                listSubdirectories
            );
            setSuggestions(dirs);
            setCompletionMode(mode);
            setShowSuggestions(dirs.length > 0);
        } catch {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [vaultUri, basePath]);

    useEffect(() => {
        if (!isFocused) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [value, isFocused, fetchSuggestions]);

    const handleSelectSuggestion = (subfolder: string) => {
        // Cancel blur if any
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        const newPath = applySuggestion(value, subfolder, completionMode);
        onChangeText(newPath);
        // Keep suggestions open — will refresh for the new path

        // Ensure focus stays
        inputRef.current?.focus();
    };

    const handleFocus = () => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setIsFocused(true);
        fetchSuggestions(value);
    };

    const handleBlur = () => {
        // Delay to allow suggestion tap to register
        blurTimeoutRef.current = setTimeout(() => {
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
                 const relativePath = resolveBrowsePath(vaultUri, result.directoryUri, basePath);
                 if (relativePath !== null) {
                     onChangeText(relativePath);
                     console.log('[FolderInput] Set relative path:', relativePath);
                 } else {
                     console.warn('[FolderInput] Could not resolve path or selected folder is not within vault');
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
             {!compact && <Text className="text-text-secondary mb-1 ml-1 text-sm font-semibold">{label}</Text>}
            <View className="flex-row gap-2">
                <View className="flex-1 relative">
                    <View className={`flex-row items-center bg-surface/50 border border-border rounded-xl ${compact ? '' : ''}`}>
                        {basePath ? (
                            <Text className={`text-secondary ${compact ? 'pl-3 text-sm' : 'pl-4'} font-medium`}>{basePath}/</Text>
                        ) : null}
                        <TextInput 
                            ref={inputRef}
                            value={value} 
                            onChangeText={onChangeText} 
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder={placeholder || (basePath ? 'subfolder...' : 'Enter folder path...')}
                            placeholderTextColor={Colors.text.tertiary}
                            className={`flex-1 ${compact ? 'p-3 text-sm' : 'p-4'} ${basePath ? 'pl-0.5' : ''} pr-12 text-white font-medium`}
                        />
                    </View>
                    {onCheckFolder && (
                        <TouchableOpacity 
                            onPress={onCheckFolder} 
                            className="absolute right-0 top-0 bottom-0 px-4 justify-center"
                        >
                            <Text className={folderStatus === 'valid' ? "text-success text-lg" : folderStatus === 'invalid' ? "text-busy text-lg" : "text-text-tertiary text-lg"}>
                                {folderStatus === 'valid' ? '✓' : folderStatus === 'invalid' ? '+' : '🔍'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    onPress={handleBrowse}
                    disabled={!vaultUri || isSelecting}
                    className={`px-4 ${compact ? 'py-3' : 'py-4'} rounded-xl ${!vaultUri || isSelecting ? 'bg-surface-highlight' : 'bg-primary'}`}
                >
                    <Text className="text-white font-semibold">Browse</Text>
                </TouchableOpacity>
            </View>
            {showSuggestions && suggestions.length > 0 && (
                <ScrollView 
                    className="bg-surface border border-border rounded-xl mt-1"
                    style={{ maxHeight: 150 }}
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled
                >
                    {suggestions.map((dir) => (
                        <TouchableOpacity
                            key={dir}
                            onPress={() => handleSelectSuggestion(dir)}
                            className="px-3 py-2.5 border-b border-border/50 flex-row items-center"
                        >
                            <Text className="text-primary mr-2">📁</Text>
                            <Text className="text-white text-sm font-medium">{dir}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}
