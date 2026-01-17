import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, TextInput } from 'react-native';
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
    const { apiKey, vaultUri, customPrompt, selectedModel } = useSettingsStore();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProcessedNote | null>(null);
    const [saving, setSaving] = useState(false);

    // Editing state
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [filename, setFilename] = useState('');
    const [folder, setFolder] = useState('');
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

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
    
    const analyze = async (text: string) => {
        setLoading(true);
        try {
            // Read vault structure for context
            let vaultStructure = '';
            const { contextRootFolder } = useSettingsStore.getState();
            let rootFolderForContext = '';
            
            if (vaultUri) {
                let targetUri = vaultUri;
                
                // If contextRootFolder is set, try to find it first
                if (contextRootFolder && contextRootFolder.trim()) {
                    const { checkDirectoryExists } = await import('../utils/saf');
                    const folderUri = await checkDirectoryExists(vaultUri, contextRootFolder.trim());
                    if (folderUri) {
                        targetUri = folderUri;
                        rootFolderForContext = contextRootFolder.trim();
                    }
                }
                
                vaultStructure = await readVaultStructure(targetUri, 2);
            }
            
            const result = await processContent(apiKey!, text, customPrompt, selectedModel, vaultStructure, rootFolderForContext);
            if (result) {
                setData(result);
                setTitle(result.title);
                setTags(result.tags);
                setFilename(result.filename);
                setFolder(result.folder);
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
        setInputText('');
        setInputMode(true);
        setLoading(false);
        setSaving(false);
        setSkipAnalyze(false);
    };

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
        if (!inputText.trim() || !vaultUri) return;
        
        setSaving(true);
        try {
            const { contextRootFolder } = useSettingsStore.getState();
            const currentDate = new Date().toISOString().split('T')[0];
            
            // Check if input is a URL
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
                    
                    // Fallback to regular HTML title extraction if YouTube failed or not YouTube
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
            
            // Fallback to first line if no title found
            if (!title) {
                const lines = inputText.trim().split('\n');
                title = lines[0].substring(0, 50).trim();
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
            
            const content = frontmatter + inputText;
            
            // Save to context root folder
            const folderPath = contextRootFolder || 'Inbox';
            await saveToVault(vaultUri, filename, content, folderPath);
            
            console.log(`[DirectSave] Saved to: ${folderPath}/${filename}`);
            
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
            
            // Save without summary - just body content
            const fileContent = `---\n${frontmatterStr}\n---\n\n# ${title}\n\n${data.body}`;

            const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
            
            // Task 7: Save first, then verify
            const savedUri = await saveToVault(vaultUri, fullFilename, fileContent, folder);
            console.log(`[Save] File saved to: ${savedUri}`);

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
            console.log(`[Linking] Relative path: ${path}`);
            console.log(`[Linking] Absolute path: ${absolutePath}`);
            
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
                    <TextInput 
                        className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-white text-lg min-h-[200px] mb-4 shadow-lg" 
                        multiline 
                        placeholder="Paste URL or type your thought..." 
                        placeholderTextColor="#94a3b8"
                        style={{ textAlignVertical: 'top' }}
                        value={inputText}
                        onChangeText={setInputText}
                        autoFocus
                    />
                    
                    {/* Skip Analyze toggle */}
                    <View className="flex-row items-center justify-between mb-4 px-1">
                        <Text className="text-indigo-200 text-sm font-semibold">Skip AI Analysis</Text>
                        <TouchableOpacity 
                            onPress={() => setSkipAnalyze(!skipAnalyze)}
                            className={`w-14 h-8 rounded-full p-1 ${skipAnalyze ? 'bg-indigo-600' : 'bg-slate-600'}`}
                        >
                            <View className={`w-6 h-6 rounded-full bg-white ${skipAnalyze ? 'ml-auto' : ''}`} />
                        </TouchableOpacity>
                    </View>
                    
                    <Button 
                        title={skipAnalyze ? "Save Directly" : "Analyze with AI"} 
                        onPress={skipAnalyze ? handleDirectSave : handleManualAnalyze} 
                    />
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
                            <View className="flex-row flex-wrap gap-2 mb-3">
                                {tags.map((tag, index) => (
                                    <View key={index} className="bg-indigo-600/80 px-3 py-1.5 rounded-full flex-row items-center border border-indigo-500/50">
                                        <Text className="text-white mr-2 text-sm font-medium">{tag}</Text>
                                        <TouchableOpacity onPress={() => removeTag(index)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <Text className="text-white/70 font-bold ml-1">×</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {tags.length === 0 && <Text className="text-slate-500 italic text-sm py-1">No tags</Text>}
                            </View>
                            <View className="flex-row gap-2">
                                <View className="flex-1">
                                    <TextInput 
                                        value={newTag} 
                                        onChangeText={setNewTag} 
                                        placeholder="Add tag..." 
                                        placeholderTextColor="#94a3b8"
                                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white font-medium"
                                        onSubmitEditing={addTag}
                                        returnKeyType="done"
                                    />
                                </View>
                                <Button title="Add" onPress={addTag} variant="secondary" className="w-auto px-6" /> 
                            </View>
                        </View>
                    </Card>

                    <Card className="items-start">
                        <Text className="text-indigo-200 text-sm font-bold mb-1">Summary</Text>
                        <Text className="text-slate-300 italic">{data?.summary}</Text>
                    </Card>

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
        </Layout>
    );
}
