import React, { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { ShareIntent } from 'expo-share-intent';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { useSettingsStore } from '../store/settings';
import { processContent, ProcessedNote } from '../services/gemini';
import { saveToVault, checkDirectoryExists, readVaultStructure } from '../utils/saf';
import { openInObsidian as openNoteInObsidian } from '../utils/obsidian';
import { getMostUsedTags } from '../utils/tagUtils';
import { processURLsInText } from '../utils/urlMetadata';

// Screen components
import { LoadingScreen } from './screens/LoadingScreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { SavingScreen } from './screens/SavingScreen';
import { InputScreen } from './screens/InputScreen';
import { PreviewScreen } from './screens/PreviewScreen';

export default function ProcessingScreen({ shareIntent, onReset, onOpenSettings }: { shareIntent: ShareIntent, onReset: () => void, onOpenSettings?: () => void }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel, contextRootFolder } = useSettingsStore();
    const analyzingRef = useRef(false);
    
    // Main state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState<ProcessedNote | null>(null);
    const [inputMode, setInputMode] = useState(!shareIntent?.text && !shareIntent?.webUrl);
    const [inputText, setInputText] = useState((shareIntent?.text || shareIntent?.webUrl) ?? '');
    
    // Edit state
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [showTagModal, setShowTagModal] = useState(false);
    const [filename, setFilename] = useState('');
    const [folder, setFolder] = useState('');
    const [body, setBody] = useState('');
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');
    
    // Attachment & recording
    const [attachedFiles, setAttachedFiles] = useState<{ uri: string; name: string; size: number; mimeType: string }[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | undefined>();
    
    // Tags
    const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    
    // Settings
    const [skipAnalyze, setSkipAnalyze] = useState(false);
    const [openInObsidian, setOpenInObsidian] = useState(true);

    // Load suggested tags
    useEffect(() => {
        if (vaultUri) {
            getMostUsedTags(vaultUri, contextRootFolder).then(setSuggestedTags);
        }
    }, [vaultUri, contextRootFolder]);
    
    // Folder validation
    const checkFolder = async () => {
        if (!vaultUri || !folder) return;
        setFolderStatus('neutral');
        const exists = await checkDirectoryExists(vaultUri, folder);
        setFolderStatus(exists ? 'valid' : 'invalid');
    };

    useEffect(() => {
        if (!vaultUri || !folder) {
            setFolderStatus('neutral');
            return;
        }
        const timer = setTimeout(() => checkFolder(), 500);
        return () => clearTimeout(timer);
    }, [folder, vaultUri]);

    // Helpers
    const clearState = () => {
        setInputText('');
        setData(null);
        setLoading(true);
        setInputMode(true);
        setTitle('');
        setFilename('');
        setFolder('');
        setBody('');
        setTags([]);
        setAttachedFiles([]);
        setSelectedTags([]);
    };

    const appendTags = (text: string) => {
        if (selectedTags.length === 0) return text;
        const tagsString = selectedTags.map(t => `#${t}`).join(' ');
        return text.trim() ? `${text.trim()}\n\n${tagsString}` : tagsString;
    };

    const getAttachmentSubfolder = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return 'Images';
        if (mimeType.startsWith('audio/')) return 'Audio';
        return 'Documents';
    };

    // Recording
    const startRecording = async () => {
        try {
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert('Permission needed', 'Microphone permission is required to record audio.');
                return;
            }
            await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
            const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
            setRecording(recording);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'Failed to start recording');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(undefined);
        
        if (uri) {
            await new Promise(resolve => setTimeout(resolve, 500));
            let size = 0;
            try {
                const info = await FileSystem.getInfoAsync(uri);
                if (info.exists) size = info.size;
            } catch (e) { console.warn('Could not get file size', e); }

            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
            setAttachedFiles(prev => [...prev, { uri, name: `Recording_${dateStr}.m4a`, size, mimeType: 'audio/m4a' }]);
        }
    };

    // Attach handlers
    const handleAttach = async () => {
        try {
            const DocumentPicker = await import('expo-document-picker');
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: true });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newFiles = result.assets.map(file => ({ uri: file.uri, name: file.name, size: file.size || 0, mimeType: file.mimeType || 'application/octet-stream' }));
                setAttachedFiles(prev => [...prev, ...newFiles]);
            }
        } catch (e) {
            console.error('[File Picker] Error:', e);
            Alert.alert('Error', 'Could not pick file');
        }
    };

    const handleCamera = async () => {
        try {
            const ImagePicker = await import('expo-image-picker');
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Required', 'Camera permission is required.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: false });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const photo = result.assets[0];
                const fileName = `photo_${Date.now()}.jpg`;
                setAttachedFiles(prev => [...prev, { uri: photo.uri, name: fileName, size: photo.fileSize || 0, mimeType: 'image/jpeg' }]);
            }
        } catch (e) {
            console.error('[Camera] Error:', e);
            Alert.alert('Error', 'Could not open camera');
        }
    };

    const handleRemoveFile = async (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
        try {
            const { deleteFile } = await import('../utils/saf');
            await deleteFile(attachedFiles[index].uri);
        } catch (e) {
            console.warn('Failed to delete file', e);
        }
    };

    const handleRemoveAttachment = async (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
        const file = attachedFiles[index];
        try {
            const subfolder = getAttachmentSubfolder(file.mimeType);
            const targetPath = `Files/${subfolder}/${file.name}`;
            const { deleteFileByPath } = await import('../utils/saf');
            
            if (vaultUri) {
                await deleteFileByPath(vaultUri, targetPath);
            }
            
            const embedding = `![[${targetPath}]]`;
            const escapedEmbedding = embedding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const embeddingRegex = new RegExp(escapedEmbedding + '\\n?', 'g');
            setBody(prev => prev.replace(embeddingRegex, '').trim());
        } catch (e) {
            console.warn('Failed to remove file from vault during preview cleanup', e);
        }
    };

    // Tag handlers
    const handleToggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(prev => prev.filter(t => t !== tag));
        } else {
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    const handleAddTag = () => setShowTagModal(true);
    
    const handleTagModalClose = () => {
        setShowTagModal(false);
        setNewTag('');
    };
    
    const handleTagModalConfirm = () => {
        if (newTag.trim()) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
            setShowTagModal(false);
        }
    };

    const removeTag = (index: number) => setTags(prev => prev.filter((_, i) => i !== index));

    // Icon handlers
    const handleRemoveIcon = () => {
        if (data) setData({ ...data, icon: undefined });
    };

    const handleIconChange = (text: string) => {
        if (data) setData({ ...data, icon: text });
    };

    const handleRemoveFrontmatterKey = (key: string) => {
        if (data?.frontmatter) {
            const newFrontmatter = { ...data.frontmatter };
            delete newFrontmatter[key];
            setData({ ...data, frontmatter: newFrontmatter });
        }
    };

    // Analyze & Save
    const analyze = async (text: string, quickSave: boolean = false) => {
        if (analyzingRef.current) return;
        analyzingRef.current = true;
        setLoading(true);
        
        try {
            let contentForAI = text;
        if (attachedFiles.length > 0) {
            const filesInfo = attachedFiles.map((f, i) => `File ${i + 1}: ${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB)`).join('\n');
            contentForAI = text.trim() ? `${filesInfo}\n\n${text}` : filesInfo;
        }

        let vaultStructure = '';
        let rootFolderForContext = '';
        if (vaultUri) {
            let targetUri = vaultUri;
            if (contextRootFolder && contextRootFolder.trim()) {
                const contextUri = await checkDirectoryExists(vaultUri, contextRootFolder.trim());
                if (contextUri) {
                    targetUri = contextUri;
                    rootFolderForContext = contextRootFolder.trim();
                }
            }
            vaultStructure = await readVaultStructure(targetUri, 2);
        }

        let customPrompt = null;
        if (customPromptPath && customPromptPath.trim()) {
            try {
                const { readFileContent } = await import('../utils/saf');
                let baseUri = vaultUri;
                if (rootFolderForContext) {
                    const contextUri = await checkDirectoryExists(vaultUri!, rootFolderForContext);
                    if (contextUri) baseUri = contextUri;
                }
                customPrompt = await readFileContent(baseUri!, customPromptPath.trim());
            } catch (e) {
                console.warn('[Analyze] Failed to read custom prompt file:', e);
            }
        }

        // Process URLs in the text
        const { embeds: urlEmbeds, cleanText, metadata: urlMetadata } = await processURLsInText(text);
        
        // Prepare context from URL metadata for AI
        let urlContext = '';
        if (urlMetadata && urlMetadata.length > 0) {
            urlContext = urlMetadata.map(m => `URL: ${m.url}\nTitle: ${m.title}\nDescription: ${m.description || ''}`).join('\n\n');
        }

        if (urlEmbeds) {
            console.log('[Analyze] Found URL embeds, prepending to content');
            
            // Use metadata context + clean text for AI analysis
            // This ensures AI has content even if input was just a URL
            contentForAI = urlContext + (cleanText.trim() ? `\n\nUser Notes:\n${cleanText}` : '');
            
            if (attachedFiles.length > 0) {
                const filesInfo = attachedFiles.map((f, i) => `File ${i + 1}: ${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB)`).join('\n');
                contentForAI = `${filesInfo}\n\n${contentForAI}`;
            }
        }

        const result = await processContent(apiKey!, contentForAI, customPrompt, selectedModel, vaultStructure, rootFolderForContext);
        
        if (result) {
            let transcriptionContext = '';
            const embeddings: string[] = [];
            
            if (attachedFiles.length > 0) {
                const { copyFileToVault } = await import('../utils/saf');
                const { transcribeAudio } = await import('../services/gemini');
                
                for (const file of attachedFiles) {
                    if (file.mimeType.startsWith('audio/')) {
                        try {
                            const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
                            const transcription = await transcribeAudio(apiKey || '', base64, file.mimeType, selectedModel || undefined);
                            if (transcription) {
                                const formatted = transcription.split('\n').map(line => `> ${line}`).join('\n');
                                transcriptionContext += `\n> [!quote] Transcription: ${file.name}\n${formatted}\n`;
                            }
                        } catch (e) {
                            console.warn(`Failed to transcribe ${file.name}`, e);
                        }
                    }

                    const subfolder = getAttachmentSubfolder(file.mimeType);
                    const targetPath = `Files/${subfolder}/${file.name}`;
                    const copiedUri = await copyFileToVault(file.uri, vaultUri!, rootFolderForContext ? `${rootFolderForContext}/${targetPath}` : targetPath);
                    if (copiedUri) embeddings.push(`![[${targetPath}]]`);
                }

                if (transcriptionContext) {
                    contentForAI = `${transcriptionContext}\n\n${contentForAI}`;
                    result.body = `${transcriptionContext}\n\n${result.body}`;
                }
                if (embeddings.length > 0) result.body = `${embeddings.join('\n')}\n\n${result.body}`;
            }

            // Prepend URL embeds to the final body
            if (urlEmbeds) {
                result.body = `${urlEmbeds}\n\n${result.body}`;
            }

            setData(result);
            setTitle(result.title);
            setFilename(result.filename);
            setFolder(result.folder);
            setBody(result.body);
            setTags(result.tags || []);

            if (quickSave) {
                await handleSave(
                    result.title,
                    result.filename,
                    result.folder,
                    result.body,
                    result.tags || [],
                    result
                );
            } else {
                setLoading(false);
                setInputMode(false);
            }

        }
        } catch (error) {
            console.error('[Analyze] Error:', error);
            Alert.alert('Error', 'Analysis failed');
            setLoading(false);
        } finally {
            analyzingRef.current = false;
        }
    };

    const handleManualAnalyze = () => {
        if (inputText.trim() || attachedFiles.length > 0) {
            analyze(appendTags(inputText));
        }
    };

    const handleDirectSave = async () => {
        if (!vaultUri || !apiKey) {
            Alert.alert('Setup Required', 'Please configure Vault and API Key in settings.');
            return;
        }

        setSaving(true);
        let processedText = appendTags(inputText);
        let transcriptionText = '';
        let rootFolderForContext = '';
        const { contextRootFolder } = useSettingsStore.getState();
        if (contextRootFolder) rootFolderForContext = contextRootFolder;

        const embeddings: string[] = [];
        if (attachedFiles.length > 0) {
            const { copyFileToVault } = await import('../utils/saf');
            const { transcribeAudio } = await import('../services/gemini');
            
            for (const file of attachedFiles) {
                if (file.mimeType.startsWith('audio/')) {
                    try {
                        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
                        const transcription = await transcribeAudio(apiKey || '', base64, file.mimeType, selectedModel || undefined);
                        if (transcription) {
                            const formatted = transcription.split('\n').map(line => `> ${line}`).join('\n');
                            transcriptionText += `\n> [!quote] Transcription\n${formatted}\n`;
                        }
                    } catch (e) {
                        console.warn(`Failed to transcribe ${file.name}`, e);
                    }
                }
                
                const subfolder = getAttachmentSubfolder(file.mimeType);
                const targetPath = `Files/${subfolder}/${file.name}`;
                const copiedUri = await copyFileToVault(file.uri, vaultUri, rootFolderForContext ? `${rootFolderForContext}/${targetPath}` : targetPath);
                if (copiedUri) embeddings.push(`![[${targetPath}]]`);
            }

            if (transcriptionText) processedText = `${transcriptionText}\n\n${inputText}`.trim();
        }

        // Process URLs
        // Process URLs
        const { embeds: urlEmbeds, cleanText } = await processURLsInText(processedText);

        const frontmatter = `---\ntags: [quick_save]\n---\n\n`;
        let content = frontmatter;
        
        if (urlEmbeds) {
            content += urlEmbeds + '\n\n';
            if (cleanText.trim()) content += cleanText + '\n\n';
        } else {
            content += processedText + '\n\n';
        }

        if (embeddings.length > 0) content += `${embeddings.join('\n')}`;
        
        content = content.trim();
        const finalFilename = `Quick Note ${new Date().toISOString().split('T')[0]}.md`;
        const finalFolder = rootFolderForContext || 'Inbox';
        
        const filePath = await saveToVault(vaultUri, finalFilename, content, finalFolder);
        
        if (filePath && openInObsidian) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await openNoteInObsidian(vaultUri, filePath);
        }

        setSaving(false);
        clearState();
        onReset();
    };

    const handleSave = async (
        overrideTitle?: string,
        overrideFilename?: string,
        overrideFolder?: string,
        overrideBody?: string,
        overrideTags?: string[],
        overrideData?: ProcessedNote
    ) => {
        if (!vaultUri) {
            Alert.alert('Error', 'Vault not configured');
            return;
        }

        const targetData = overrideData || data;
        const targetFilename = overrideFilename || filename;
        const targetFolder = overrideFolder || folder;
        const targetBody = overrideBody || body;
        const targetTags = overrideTags || tags;

        setSaving(true);
        const frontmatterEntries: string[] = [];
        if (targetData?.icon) frontmatterEntries.push(`icon: "${targetData.icon}"`);
        if (targetTags.length > 0) frontmatterEntries.push(`tags: [${targetTags.join(', ')}]`);
        if (targetData?.frontmatter) {
            Object.entries(targetData.frontmatter).forEach(([key, value]) => {
                frontmatterEntries.push(`${key}: ${JSON.stringify(value)}`);
            });
        }

        const frontmatter = frontmatterEntries.length > 0 ? `---\n${frontmatterEntries.join('\n')}\n---\n\n` : '';
        const content = frontmatter + targetBody;
        
        const filePath = await saveToVault(vaultUri, targetFilename, content, targetFolder);
        
        if (filePath && openInObsidian) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await openNoteInObsidian(vaultUri, filePath);
        }

        setSaving(false);
        clearState();
        onReset();
    };

    // Auto-analyze on mount
    useEffect(() => {
        if (!inputMode && (shareIntent?.text || shareIntent?.webUrl)) {
            analyze((shareIntent?.text || shareIntent?.webUrl) ?? '');
        } else {
            setLoading(false);
        }
    }, []);

    // Render screens
    if (loading && !inputMode) return <LoadingScreen />;
    if (saving) return <SavingScreen />;
    if (!data && !loading && !inputMode) return <ErrorScreen onRetry={() => setInputMode(true)} onClose={() => { clearState(); onReset(); }} />;
    
    if (inputMode && !loading) {
        return (
            <InputScreen
                inputText={inputText}
                onInputTextChange={setInputText}
                attachedFiles={attachedFiles}
                onRemoveFile={handleRemoveFile}
                suggestedTags={suggestedTags}
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
                skipAnalyze={skipAnalyze}
                onToggleSkipAnalyze={() => setSkipAnalyze(!skipAnalyze)}
                openInObsidian={openInObsidian}
                onToggleObsidian={() => setOpenInObsidian(!openInObsidian)}
                onPreview={handleManualAnalyze}
                onQuickSave={() => analyze(appendTags(inputText), true)}
                onDirectSave={handleDirectSave}
                onCancel={() => { clearState(); onReset(); }}
                onAttach={handleAttach}
                onCamera={handleCamera}
                onRecord={recording ? stopRecording : startRecording}
                recording={!!recording}
                disabled={loading ||  saving}
                onOpenSettings={onOpenSettings}
            />
        );
    }

    if (data) {
        return (
            <PreviewScreen
                data={data}
                title={title}
                onTitleChange={setTitle}
                filename={filename}
                onFilenameChange={setFilename}
                folder={folder}
                onFolderChange={setFolder}
                folderStatus={folderStatus}
                onCheckFolder={checkFolder}
                tags={tags}
                onRemoveTag={removeTag}
                onAddTag={handleAddTag}
                body={body}
                onBodyChange={setBody}
                attachedFiles={attachedFiles}
                onRemoveAttachment={handleRemoveAttachment}
                onSave={() => handleSave()}
                onBack={() => {
                    setData(null);
                    setInputMode(true);
                }}
                saving={saving}
                vaultUri={vaultUri}
                onOpenSettings={onOpenSettings}
                showTagModal={showTagModal}
                newTag={newTag}
                onNewTagChange={setNewTag}
                onTagModalClose={handleTagModalClose}
                onTagModalConfirm={handleTagModalConfirm}
                onRemoveIcon={handleRemoveIcon}
                onIconChange={handleIconChange}
                onRemoveFrontmatterKey={handleRemoveFrontmatterKey}
                onAttach={handleAttach}
                onCamera={handleCamera}
                onRecord={recording ? stopRecording : startRecording}
                recording={!!recording}
            />
        );
    }

    return <LoadingScreen />;
}
