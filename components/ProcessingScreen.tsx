import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { ShareIntent } from 'expo-share-intent';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, FadeIn } from 'react-native-reanimated';
import * as Linking from 'expo-linking';

import { Layout } from './ui/Layout';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useSettingsStore } from '../store/settings';
import { processContent, ProcessedNote } from '../services/gemini';
import { saveToVault, checkDirectoryExists, readVaultStructure } from '../utils/saf';
import { FolderInput } from './ui/FolderInput';
import { FileAttachment } from './ui/FileAttachment';



function PulsingIcon() {
    const scale = useSharedValue(1);
    useEffect(() => {
        scale.value = withRepeat(withTiming(1.2, { duration: 1000, easing: Easing.ease }), -1, true);
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
        <View className="items-center justify-center p-10">
            <Animated.View style={style} className="w-24 h-24 bg-indigo-500 rounded-full opacity-30 absolute" />
            <View className="w-16 h-16 bg-indigo-400 rounded-full items-center justify-center shadow-lg shadow-indigo-500/50">
                 <Text className="text-2xl">🧠</Text>
            </View>
        </View>
    );
}

export default function ProcessingScreen({ shareIntent, onReset, onOpenSettings }: { shareIntent: ShareIntent, onReset: () => void, onOpenSettings?: () => void }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel } = useSettingsStore();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProcessedNote | null>(null);
    const [saving, setSaving] = useState(false);

    // Editing state
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [showTagModal, setShowTagModal] = useState(false);
    const [filename, setFilename] = useState('');
    const [folder, setFolder] = useState('');
    const [body, setBody] = useState('');
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    
    // File attachment state
    const [attachedFiles, setAttachedFiles] = useState<{ uri: string; name: string; size: number; mimeType: string }[]>([]);

    const checkFolder = async () => {
        if (!vaultUri || !folder) return;
        setFolderStatus('neutral');
        const exists = await checkDirectoryExists(vaultUri, folder);
        setFolderStatus(exists ? 'valid' : 'invalid');
    };

    // Reactive folder validation (Task 1)
    useEffect(() => {
        if (!vaultUri || !folder) {
            setFolderStatus('neutral');
            return;
        }
        
        const timer = setTimeout(() => {
            checkFolder();
        }, 500); // Debounce 500ms

        return () => clearTimeout(timer);
    }, [folder, vaultUri]);

    const [inputMode, setInputMode] = useState(!shareIntent?.text && !shareIntent?.webUrl);
    const [inputText, setInputText] = useState((shareIntent?.text || shareIntent?.webUrl) ?? '');
    const [includeSummary, setIncludeSummary] = useState(false); // Task 21: Renamed and inverted
    const [skipAnalyze, setSkipAnalyze] = useState(false); // Skip AI analysis toggle
    const [openInObsidian, setOpenInObsidian] = useState(true); // Toggle for opening Obsidian after save
    
    const analyze = async (text: string, skipPreview: boolean = false) => {
        setLoading(true);
        try {
            // Prepare content for AI
            let contentForAI = text;
            
            // If files are attached, include file metadata along with input text
            if (attachedFiles.length > 0) {
                const filesInfo = attachedFiles.map((f, i) => `File ${i+1}: ${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB)`).join('\n');
                // Include both file info and input text if present
                contentForAI = text.trim() ? `${filesInfo}\n\n${text}` : filesInfo;
            }
            
            // Read vault structure for context
            let vaultStructure = '';
            const { contextRootFolder } = useSettingsStore.getState();
            let rootFolderForContext = '';
            
            if (vaultUri) {
                let targetUri = vaultUri;
                
                // If contextRootFolder is set, try to find it first
                if (contextRootFolder && contextRootFolder.trim()) {
                    const contextUri = await checkDirectoryExists(vaultUri, contextRootFolder.trim());
                    if (contextUri) {
                        targetUri = contextUri;
                        rootFolderForContext = contextRootFolder.trim();
                    }
                }
                
                vaultStructure = await readVaultStructure(targetUri, 2);
            }
            
            // Read custom prompt from file if path is specified
            let customPrompt: string | null = null;
            if (vaultUri && customPromptPath && customPromptPath.trim()) {
                try {
                    const { readFileContent, checkDirectoryExists } = await import('../utils/saf');
                    
                    // Determine base URI - use context root if specified
                    let baseUri = vaultUri;
                    if (rootFolderForContext && rootFolderForContext.trim()) {
                        const contextUri = await checkDirectoryExists(vaultUri, rootFolderForContext.trim());
                        if (contextUri) {
                            baseUri = contextUri;
                        }
                    }
                    
                    customPrompt = await readFileContent(baseUri, customPromptPath.trim());
                    console.log('[Analyze] Loaded custom prompt from file:', customPromptPath);
                } catch (e) {
                    console.warn('[Analyze] Failed to read custom prompt file:', e);
                }
            }
            
            const result = await processContent(apiKey!, contentForAI, customPrompt, selectedModel, vaultStructure, rootFolderForContext);
            if (result) {
                // Helper to strip emoji/icon prefix from text
                const stripIconPrefix = (text: string): string => {
                    // Remove Font Awesome format like "FasIconName " at the start (with or without %)
                    return text.replace(/^Fas[A-Z][a-zA-Z]*\s+/g, '').replace(/^Fas%[^%]+%\s*/g, '').trim();
                };
                
                // If files were attached, copy them to vault and update body with embeddings
                if (attachedFiles.length > 0) {
                    const { copyFileToVault } = await import('../utils/saf');
                    const embeddings: string[] = [];
                    
                    for (const file of attachedFiles) {
                         const targetPath = `Files/${file.name}`;
                         const copiedUri = await copyFileToVault(
                            file.uri,
                            vaultUri!,
                            rootFolderForContext ? `${rootFolderForContext}/${targetPath}` : targetPath
                        );
                        
                        if (copiedUri) {
                            embeddings.push(`![[${targetPath}]]`);
                        }
                    }
                    
                    if (embeddings.length > 0) {
                        // Append embeddings to the end of the body or insert at top?
                        // Usually better at the end or where context fit. 
                        // For now appending with double newline
                        result.body = `${result.body}\n\n${embeddings.join('\n')}`;
                    }
                }

                if (skipPreview) {
                    // QUICK SAVE LOGIC
                    const currentDate = new Date().toISOString().split('T')[0];
                    const sourceValue = (!shareIntent?.text && !shareIntent?.webUrl && !text.startsWith('http')) ? 'manual' : result.frontmatter.source || text;
                    
                    const frontmatterObj = { 
                        ...result.frontmatter, 
                        tags: result.tags, 
                        source: sourceValue,
                        date: currentDate,
                        ...(result.icon ? { icon: result.icon } : {}) 
                    };
                    const frontmatterStr = Object.entries(frontmatterObj).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
                    
                    const fileContent = `---\n${frontmatterStr}\n---\n\n# ${stripIconPrefix(result.title)}\n\n${result.body}`;
                    const fullFilename = stripIconPrefix(result.filename).endsWith('.md') ? stripIconPrefix(result.filename) : `${stripIconPrefix(result.filename)}.md`;
                    
                    await saveToVault(vaultUri!, fullFilename, fileContent, result.folder);
                    
                    if (openInObsidian) {
                        // Open Logic (Duplicated for now/inline)
                        const path = result.folder ? `${result.folder}/${fullFilename}` : fullFilename;
                        let absolutePath = '';
                        try {
                            const decoded = decodeURIComponent(vaultUri!);
                            const pathMatch = decoded.match(/(?:tree|document)\/(.+?)$/);
                            if (pathMatch && pathMatch[1]) {
                                let vaultPath = pathMatch[1].replace(/primary:/, '/storage/emulated/0/');
                                absolutePath = `${vaultPath}/${path}`;
                            }
                        } catch (e) {
                            console.warn('[Linking] Could not extract absolute path:', e);
                        }
                        
                        const obsidianUrl = absolutePath
                            ? `obsidian://open?file=${encodeURIComponent(absolutePath)}`
                            : `obsidian://open?file=${encodeURIComponent(path)}`;
                        
                        await new Promise(resolve => setTimeout(resolve, 500));
                        Linking.openURL(obsidianUrl).catch(err => console.error("Failed to open Obsidian", err));
                    } else {
                        Alert.alert('Success', `Saved to ${result.folder}/${fullFilename}`);
                    }
                    
                    setLoading(false); // Stop loading before reset
                    clearState();
                    onReset();
                    return;
                }
                
                setData(result);
                setTitle(stripIconPrefix(result.title));
                setTags(result.tags);
                setFilename(stripIconPrefix(result.filename));
                setFolder(result.folder);
                setBody(result.body);
                setInputMode(false);
            }
            setLoading(false);
        } catch (e: any) {
            console.error("[AI Processing Error]:", e);
            const errorMsg = e?.message || e?.toString() || "Unknown error";
            Alert.alert("AI Processing Failed", `Error: ${errorMsg}\n\nPlease check your API key and try again.`);
            setLoading(false);
        }
    };

    // Clear all state to reset to "take a note" screen
    const clearState = () => {
        setData(null);
        setTitle('');
        setTags([]);
        setFilename('');
        setFolder('');
        setBody('');
        setInputText('');
        setAttachedFiles([]);
        setInputMode(true);
        setLoading(false);
        setSaving(false);
        setSkipAnalyze(false);
    };

    // Handle share intent
    useEffect(() => {
        if (!shareIntent) {
            setLoading(false);
            return;
        }

        const handleShare = async () => {
            try {
                // Handle file attachments
                if (shareIntent.files && shareIntent.files.length > 0) {
                    setAttachedFiles(shareIntent.files.map(file => ({
                        uri: file.path,
                        name: file.fileName || 'shared_file',
                        size: file.size || 0,
                        mimeType: file.mimeType || 'application/octet-stream'
                    })));
                    setInputText(''); // Start with empty text so user can add description
                    setInputMode(true);
                    setLoading(false);
                    return;
                }

                // Handle text/URL
                if (shareIntent.text) {
                    setInputText(shareIntent.text);
                    setInputMode(true);
                    setLoading(false);
                } else {
                    setLoading(false);
                }
            } catch (e) {
                console.error('[Share Intent] Error:', e);
                setLoading(false);
            }
        };

        handleShare();
    }, [shareIntent]);
    useEffect(() => {
        const content = shareIntent?.text || shareIntent?.webUrl;
        if (content) {
            setInputText(content);
            // Task 23: Set includeSummary default - ON for manual notes, OFF for URLs
            const isUrl = shareIntent?.webUrl || (shareIntent?.text?.startsWith('http://') || shareIntent?.text?.startsWith('https://'));
            setIncludeSummary(!isUrl); // ON for notes (not URL), OFF for URLs
            // If we have content, auto-analyze it (unless it's the "empty" intent passed by index? 
            // empty intent has valid structure but empty strings. content will be empty string -> falsy)
            analyze(content);
        } else {
            setLoading(false);
            setInputMode(true); // If no content, force input mode
        }
    }, [shareIntent, apiKey]); // Re-run when intent changes

    const handleManualAnalyze = () => {
        if (inputText.trim()) {
            analyze(inputText);
        }
    };

    const handleDirectSave = async () => {
        if ((!inputText.trim() && attachedFiles.length === 0) || !vaultUri) return;
        
        setSaving(true);
        try {
            const { contextRootFolder } = useSettingsStore.getState();
            const currentDate = new Date().toISOString().split('T')[0];
            
            let embeddings = '';
            
            // Handle file attachments
            if (attachedFiles.length > 0) {
                const { copyFileToVault } = await import('../utils/saf');
                for (const file of attachedFiles) {
                    // Copy file to Files folder
                    const targetPath = `Files/${file.name}`;
                    const copiedUri = await copyFileToVault(
                        file.uri,
                        vaultUri,
                        contextRootFolder ? `${contextRootFolder}/${targetPath}` : targetPath
                    );
                    
                    if (copiedUri) {
                        embeddings += `![[${targetPath}]]\n`;
                    }
                }
            }
            
            // Handle URL/text (existing logic)
            const isUrl = inputText.trim().startsWith('http://') || inputText.trim().startsWith('https://');
            let title = '';
            let filename = '';
            
            if (isUrl) {
                // Try to fetch page title
                try {
                    const url = inputText.trim();
                    
                    // Special handling for YouTube URLs
                    if (url.includes('youtube.com') || url.includes('youtu.be')) {
                        try {
                            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                            const oembedResponse = await fetch(oembedUrl);
                             if (oembedResponse.ok) {
                                const oembedData = await oembedResponse.json();
                                if (oembedData.title) {
                                    title = oembedData.title.substring(0, 50);
                                    console.log('[DirectSave] YouTube title from oembed:', title);
                                }
                            }
                        } catch (e) {
                            console.warn('[DirectSave] YouTube oembed failed:', e);
                        }
                    }
                    
                    // Fallback to regular HTML title extraction
                    if (!title) {
                        const response = await fetch(url);
                        const html = await response.text();
                        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                        if (titleMatch && titleMatch[1]) {
                            title = titleMatch[1].trim().substring(0, 50);
                        }
                    }
                } catch (e) {
                    console.warn('[DirectSave] Could not fetch page title:', e);
                }
            }
            
            // Fallback to first line or generic name if no title found
            if (!title) {
                if (inputText.trim()) {
                    const lines = inputText.trim().split('\n');
                    title = lines[0].substring(0, 50).trim();
                } else if (attachedFiles.length > 0) {
                     title = `Attachments ${new Date().toLocaleString()}`;
                } else {
                    title = `Note ${new Date().toLocaleString()}`;
                }
            }
            
            filename = `${title.replace(/[^a-zA-Z0-9-_ ]/g, '')}.md`;
            
            // Determine source
            const source = isUrl ? inputText.trim() : 'manual';
            
            // Minimal frontmatter
            const frontmatter = `---
date: ${currentDate}
source: ${JSON.stringify(source)}
---

`;
            
            const content = frontmatter + inputText + (embeddings ? `\n\n${embeddings}` : '');
            
            // Save to context root folder
            const folderPath = contextRootFolder || 'Inbox';
            await saveToVault(vaultUri, filename, content, folderPath);
            
            
            console.log(`[DirectSave] Saved to: ${folderPath}/${filename}`);

            if (openInObsidian) {
                // Reuse linking logic (should extract this to helper function)
                const path = `${folderPath}/${filename}`;
                let absolutePath = '';
                try {
                    const decoded = decodeURIComponent(vaultUri!);
                    const pathMatch = decoded.match(/(?:tree|document)\/(.+?)$/);
                    if (pathMatch && pathMatch[1]) {
                        let vaultPath = pathMatch[1].replace(/primary:/, '/storage/emulated/0/');
                        absolutePath = `${vaultPath}/${path}`;
                    }
                } catch (e) {
                    console.warn('[Linking] Could not extract absolute path:', e);
                }
                
                const obsidianUrl = absolutePath
                    ? `obsidian://open?file=${encodeURIComponent(absolutePath)}`
                    : `obsidian://open?file=${encodeURIComponent(path)}`;
                
                await new Promise(resolve => setTimeout(resolve, 500));
                Linking.openURL(obsidianUrl).catch(err => console.error("Failed to open Obsidian", err));
            } else {
                Alert.alert('Success', `Note saved: ${filename}`);
            }
            
            // Clear and reset
            clearState();
            onReset();
        } catch (e) {
            console.error("[DirectSave] Error:", e);
            Alert.alert("Save Error", "Could not save note.");
        } finally {
            setSaving(false);
        }
    };

    const addTag = () => {
        const trimmed = newTag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setNewTag('');
            setShowTagModal(false);
        }
    };

    const removeTag = (index: number) => {
        setTags(tags.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!data || !vaultUri) return;
        setSaving(true);
        try {
            // Task 8: Add manual source for manual input mode, but use URL if it's a URL
            const isManualInput = !shareIntent?.text && !shareIntent?.webUrl;
            let sourceValue = data.frontmatter.source || '';
            
            if (isManualInput) {
                // Check if manual input is a URL
                const isUrl = inputText.trim().startsWith('http://') || inputText.trim().startsWith('https://');
                sourceValue = isUrl ? inputText.trim() : 'manual';
            }
            
            // Add current date
            const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            
            // Reconstruct content with frontmatter
            const frontmatterObj = { 
                ...data.frontmatter, 
                tags, 
                source: sourceValue,
                date: currentDate,
                ...(data.icon ? { icon: data.icon } : {}) 
            };
            const frontmatterStr = Object.entries(frontmatterObj).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
            
            // Save with editable body content
            const fileContent = `---\n${frontmatterStr}\n---\n\n# ${title}\n\n${body}`;

            const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
            
            // Task 7: Save first, then verify
            const savedUri = await saveToVault(vaultUri, fullFilename, fileContent, folder);
            console.log(`[Save] File saved to: ${savedUri}`);

            if (openInObsidian) {
                // Open in Obsidian using absolute file path
                const path = folder ? `${folder}/${fullFilename}` : fullFilename;
                
                // Convert SAF URI to absolute file path for Obsidian
                let absolutePath = '';
                try {
                    const decoded = decodeURIComponent(vaultUri);
                    const pathMatch = decoded.match(/(?:tree|document)\/(.+?)$/);
                    if (pathMatch && pathMatch[1]) {
                        // Convert "primary:Documents/Vault" to "/storage/emulated/0/Documents/Vault"
                        let vaultPath = pathMatch[1].replace(/primary:/, '/storage/emulated/0/');
                        // Append the file path
                        absolutePath = `${vaultPath}/${path}`;
                    }
                } catch (e) {
                    console.warn('[Linking] Could not extract absolute path:', e);
                }
                
                // Use file:// protocol with absolute path
                const obsidianUrl = absolutePath
                    ? `obsidian://open?file=${encodeURIComponent(absolutePath)}`
                    : `obsidian://open?file=${encodeURIComponent(path)}`;
                
                console.log(`[Linking] Opening URL: ${obsidianUrl}`);
                
                // Give file system ample time to flush
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Try to open Obsidian with retries (canOpenURL is unreliable on Android)
                let openSuccess = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`[Linking] Attempt ${attempt} to open Obsidian`);
                        await Linking.openURL(obsidianUrl);
                        console.log("[Linking] Successfully opened Obsidian");
                        openSuccess = true;
                        break;
                    } catch (err) {
                        console.warn(`[Linking] Attempt ${attempt} failed:`, err);
                        if (attempt < 3) {
                            // Wait 500ms before retry
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                }
                
                if (!openSuccess) {
                    console.error("[Linking] Failed to open Obsidian after 3 attempts");
                }
            } else {
                 Alert.alert('Success', 'Note saved to vault');
            }
            
            // Clear state and reset after everything completes
            clearState();
            onReset();
        } catch (e) {
            console.error("[Save] Error:", e);
            Alert.alert("Save Error", "Could not write to vault.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <View className="flex-1 justify-center items-center">
                    <PulsingIcon />
                    <Text className="text-white text-lg font-medium mt-4 animate-pulse">Analyzing Content...</Text>
                </View>
            </Layout>
        );
    }

    if (inputMode && !loading) {
        return (
            <Layout>
                {/* Settings button header */}
                <View className="flex-row justify-between items-center px-4 pt-2 pb-1">
                    <Text className="text-2xl font-bold text-white">Take a Note</Text>
                    {onOpenSettings && (
                        <TouchableOpacity onPress={onOpenSettings} className="p-2 bg-slate-800 rounded-full">
                            <Text className="text-xl">⚙️</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View className="flex-1 p-4">
                    {/* Text input with embedded attach and camera buttons */}
                    <View className="mb-4 relative">
                        <TextInput 
                            className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 pr-24 text-white text-lg shadow-lg" 
                            multiline 
                            placeholder="Paste URL or type your thought..." 
                            placeholderTextColor="#94a3b8"
                            style={{ textAlignVertical: 'top', minHeight: 200, maxHeight: 400 }}
                            value={inputText}
                            onChangeText={setInputText}
                            autoFocus
                        />
                        
                        {/* Camera button */}
                        <TouchableOpacity 
                            onPress={async () => {
                                if (loading || saving) return;
                                
                                try {
                                    const ImagePicker = await import('expo-image-picker');
                                    
                                    // Request camera permissions
                                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                                    if (status !== 'granted') {
                                        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
                                        return;
                                    }
                                    
                                    const result = await ImagePicker.launchCameraAsync({
                                        mediaTypes: ['images'],
                                        quality: 0.8,
                                        allowsEditing: false,
                                    });

                                    if (!result.canceled && result.assets && result.assets.length > 0) {
                                        const photo = result.assets[0];
                                        const fileName = `photo_${Date.now()}.jpg`;
                                        setAttachedFiles(prev => [...prev, {
                                            uri: photo.uri,
                                            name: fileName,
                                            size: photo.fileSize || 0,
                                            mimeType: 'image/jpeg'
                                        }]);
                                    }
                                } catch (e) {
                                    console.error('[Camera] Error:', e);
                                    Alert.alert('Error', 'Could not open camera');
                                }
                            }}
                            className="absolute top-2 right-14 bg-slate-700/90 p-2 rounded-lg"
                            disabled={loading || saving}
                        >
                            <Text className="text-lg">📷</Text>
                        </TouchableOpacity>
                        
                        {/* Attach file button */}
                        <TouchableOpacity 
                            onPress={async () => {
                                if (loading || saving) return;
                                
                                try {
                                    const DocumentPicker = await import('expo-document-picker');
                                    const result = await DocumentPicker.getDocumentAsync({
                                        type: '*/*',
                                        copyToCacheDirectory: true,
                                        multiple: true // Allow multiple selection
                                    });

                                    if (!result.canceled && result.assets && result.assets.length > 0) {
                                        const newFiles = result.assets.map(file => ({
                                            uri: file.uri,
                                            name: file.name,
                                            size: file.size || 0,
                                            mimeType: file.mimeType || 'application/octet-stream'
                                        }));
                                        
                                        setAttachedFiles(prev => [...prev, ...newFiles]);
                                    }
                                } catch (e) {
                                    console.error('[File Picker] Error:', e);
                                    Alert.alert('Error', 'Could not pick file');
                                }
                            }}
                            className="absolute top-2 right-2 bg-slate-700/90 p-2 rounded-lg"
                            disabled={loading || saving}
                        >
                            <Text className="text-lg">📎</Text>
                        </TouchableOpacity>
                    </View>
                    
                    {/* File attachment info */}
                    {attachedFiles.length > 0 && (
                        <View className="mb-4">
                            {attachedFiles.map((file, index) => (
                                <FileAttachment 
                                    key={`${file.name}-${index}`}
                                    file={file} 
                                    onRemove={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))} 
                                    showRemove={true}
                                />
                            ))}
                        </View>
                    )}
                    
                    {/* Settings Toggles Row - Using Row for compact layout */}
                    <View className="flex-row items-center justify-between mb-4 px-1 gap-2">
                        {/* Skip Analyze Toggle */}
                        <View className="flex-1 flex-row items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                             <Text className="text-indigo-200 text-xs font-semibold mr-2">Skip AI</Text>
                             <TouchableOpacity 
                                onPress={() => setSkipAnalyze(!skipAnalyze)}
                                className={`w-10 h-6 rounded-full p-0.5 ${skipAnalyze ? 'bg-indigo-600' : 'bg-slate-600'}`}
                            >
                                <View className={`w-5 h-5 rounded-full bg-white ${skipAnalyze ? 'ml-auto' : ''}`} />
                            </TouchableOpacity>
                        </View>

                        {/* Open in Obsidian Toggle */}
                        <View className="flex-1 flex-row items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                             <Text className="text-indigo-200 text-xs font-semibold mr-2">Obsidian</Text>
                             <TouchableOpacity 
                                onPress={() => setOpenInObsidian(!openInObsidian)}
                                className={`w-10 h-6 rounded-full p-0.5 ${openInObsidian ? 'bg-indigo-600' : 'bg-slate-600'}`}
                            >
                                <View className={`w-5 h-5 rounded-full bg-white ${openInObsidian ? 'ml-auto' : ''}`} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    {/* Buttons */}
                    <View className="flex-row gap-3">
                         <View className="flex-1">
                            <Button 
                                title={skipAnalyze ? "Save directly" : "Preview"} 
                                onPress={skipAnalyze ? handleDirectSave : handleManualAnalyze} 
                            />
                         </View>
                         {!skipAnalyze && (
                             <View className="flex-1">
                                <Button 
                                    title="Quick Save" 
                                    onPress={() => analyze(inputText, true)}
                                    // Using primary styling for now as there isn't a secondary variant that stands out differently enough yet
                                />
                             </View>
                         )}
                    </View>
                    <View className="h-4" />
                    <Button 
                        title="Cancel" 
                        onPress={() => { clearState(); onReset(); }} 
                        variant="secondary" 
                    />
                </View>
            </Layout>
        );
    }

    if (!data && !loading) {
         return (
             <Layout>
                 <View className="flex-1 justify-center items-center">
                     <Text className="text-red-400">Failed to generate content.</Text>
                     <Button title="Retry" onPress={() => setInputMode(true)} variant="secondary" />
                     <View className="h-4" />
                     <Button title="Close" onPress={onReset} variant="secondary" />
                 </View>
             </Layout>
         );
    }

    // Show loading screen while saving
    if (saving) {
        return (
            <Layout>
                <View className="flex-1 justify-center items-center">
                    <PulsingIcon />
                    <Text className="text-white text-lg font-medium mt-4 animate-pulse">Saving & Opening...</Text>
                </View>
            </Layout>
        );
    }

    return (
        <Layout>
            {/* Task 6: Settings button header */}
            <View className="flex-row justify-between items-center px-4 pt-2 pb-1">
                <Text className="text-2xl font-bold text-white">Preview</Text>
                {onOpenSettings && (
                    <TouchableOpacity onPress={onOpenSettings} className="p-2 bg-slate-800 rounded-full">
                        <Text className="text-xl">⚙️</Text>
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeIn.duration(500)}>
                    
                    <Card>
                        {data.icon && (
                            <View className="mb-4">
                                <Text className="text-indigo-200 mb-1 ml-1 text-sm font-semibold">Icon</Text>
                                <View className="flex-row items-center gap-2">
                                    <View className="flex-1">
                                        <TextInput 
                                            value={data.icon}
                                            onChangeText={(text) => setData(data ? {...data, icon: text} : null)}
                                            placeholder="Icon (emoji or Font Awesome)"
                                            placeholderTextColor="#94a3b8"
                                            className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-white font-medium"
                                        />
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setData(data ? {...data, icon: undefined} : null)}
                                        className="bg-slate-700 px-3 py-3 rounded-xl"
                                    >
                                        <Text className="text-white font-semibold">✕</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        <Input label="Title" value={title} onChangeText={setTitle} />
                        <Input label="Filename" value={filename} onChangeText={setFilename} />
                        <FolderInput 
                            label="Folder"
                            value={folder}
                            onChangeText={setFolder}
                            vaultUri={vaultUri}
                            folderStatus={folderStatus}
                            onCheckFolder={checkFolder}
                            placeholder="e.g., Inbox/Notes"
                        />
                        
                        <View className="mb-4">
                            <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Tags</Text>
                            <View className="flex-row flex-wrap gap-2">
                                {tags.map((tag, index) => (
                                    <View key={index} className="bg-indigo-600/80 px-3 py-1.5 rounded-full flex-row items-center border border-indigo-500/50">
                                        <Text className="text-white mr-2 text-sm font-medium">{tag}</Text>
                                        <TouchableOpacity onPress={() => removeTag(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Text className="text-white/70 font-bold ml-1">×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {/* Add tag button */}
                                <TouchableOpacity 
                                    onPress={() => setShowTagModal(true)}
                                    className="bg-slate-700 px-3 py-1.5 rounded-full flex-row items-center border border-slate-600"
                                >
                                    <Text className="text-white text-sm font-medium">+ Add Tag</Text>
                                </TouchableOpacity>
                            </View>
                            
                            {/* Metadata pills inline with tags */}
                            {data?.frontmatter && Object.keys(data.frontmatter).length > 0 && (
                                <View className="flex-row flex-wrap gap-2 mt-2">
                                    {Object.entries(data.frontmatter).map(([key, value]) => (
                                        <View key={key} className="bg-slate-700/80 px-3 py-1.5 rounded-full flex-row items-center border border-slate-600/50">
                                            <Text className="text-slate-400 text-xs mr-1">{key}:</Text>
                                            <Text className="text-slate-200 text-xs mr-2">{typeof value === 'string' ? value : JSON.stringify(value)}</Text>
                                            <TouchableOpacity 
                                                onPress={() => {
                                                    if (data?.frontmatter) {
                                                        const newFrontmatter = { ...data.frontmatter };
                                                        delete newFrontmatter[key];
                                                        setData({ ...data, frontmatter: newFrontmatter });
                                                    }
                                                }}
                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                            >
                                                <Text className="text-slate-400 font-bold ml-1">×</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </Card>

                    {/* File attachment info in preview */}
                    {attachedFiles.length > 0 && (
                        <View className="mb-2">
                             {attachedFiles.map((file, index) => (
                                <FileAttachment 
                                    key={`preview-${file.name}-${index}`}
                                    file={file} 
                                    showRemove={false}
                                />
                            ))}
                        </View>
                    )}

                    {/* Body Content - Full width like take-a-note */}
                    <View className="mb-4">
                        <Text className="text-indigo-200 mb-2 ml-1 text-sm font-semibold">Content</Text>
                        <TextInput
                            value={body}
                            onChangeText={setBody}
                            multiline
                            placeholder="Note content..."
                            placeholderTextColor="#94a3b8"
                            className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white"
                            style={{ textAlignVertical: 'top', minHeight: 200, maxHeight: 400 }}
                        />
                    </View>

                    <View className="py-4">
                    <Button 
                        title="Save to Vault" 
                        onPress={handleSave} 
                        disabled={saving || !vaultUri} 
                    />
                    <View className="h-4" />
                    <Button 
                        title="Cancel" 
                        onPress={() => { clearState(); onReset(); }} 
                        variant="secondary" 
                    />
                    </View>
                    </Animated.View>
            </ScrollView>

            {/* Tag Input Modal */}
            <Modal visible={showTagModal} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-slate-900 rounded-3xl p-6 w-[85%] max-w-md">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white text-xl font-bold">Add Tag</Text>
                            <TouchableOpacity onPress={() => { setShowTagModal(false); setNewTag(''); }}>
                                <Text className="text-white text-2xl">✕</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row gap-2">
                            <View className="flex-1">
                                <TextInput 
                                    value={newTag} 
                                    onChangeText={setNewTag} 
                                    placeholder="Enter tag name..." 
                                    placeholderTextColor="#94a3b8"
                                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-medium"
                                    onSubmitEditing={addTag}
                                    returnKeyType="done"
                                    autoFocus
                                />
                            </View>
                            <TouchableOpacity 
                                onPress={addTag}
                                className="px-6 py-4 rounded-xl bg-indigo-600"
                            >
                                <Text className="text-white font-semibold">Add</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </Layout>
    );
}
