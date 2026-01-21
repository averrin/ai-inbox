import React, { useEffect, useState, useRef } from 'react';
import { Alert, Modal } from 'react-native';
import { ShareIntent } from 'expo-share-intent';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { useSettingsStore } from '../store/settings';
import { useGoogleStore } from '../store/googleStore';
import { processContent, ProcessedNote } from '../services/gemini';
import { CalendarService } from '../services/calendarService';
import { TasksService } from '../services/tasksService';
import { saveToVault, checkDirectoryExists, readVaultStructure } from '../utils/saf';
import { openInObsidian as openNoteInObsidian } from '../utils/obsidian';
import { getMostUsedTags } from '../utils/tagUtils';
import { processURLsInText, URLMetadata } from '../utils/urlMetadata';

// Screen components
import { LoadingScreen } from './screens/LoadingScreen';
import SetupScreen from './SetupScreen';
import { ErrorScreen } from './screens/ErrorScreen';
import { SavingScreen } from './screens/SavingScreen';
import { InputScreen } from './screens/InputScreen';
import { PreviewScreen } from './screens/PreviewScreen';

export default function ProcessingScreen({ shareIntent, onReset, onOpenSettings }: { shareIntent: ShareIntent, onReset: () => void, onOpenSettings?: () => void }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel, contextRootFolder } = useSettingsStore();
    const analyzingRef = useRef(false);
    
    // Main state
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [internalShowSettings, setInternalShowSettings] = useState(false);
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
    const [links, setLinks] = useState<URLMetadata[]>([]);
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
        setLoading(false);
        setInputMode(true);
        setTitle('');
        setFilename('');
        setFolder('');
        setBody('');
        setTags([]);
        setAttachedFiles([]);
        setLinks([]);
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
        const file = attachedFiles[index];
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
        
        try {
            const subfolder = getAttachmentSubfolder(file.mimeType);
            const targetPath = `Files/${subfolder}/${file.name}`;
            
            // Remove from body/content
            const embedding = `![[${targetPath}]]`;
            const escapedEmbedding = embedding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const embeddingRegex = new RegExp(escapedEmbedding + '\\n?', 'g');
            setBody(prev => prev.replace(embeddingRegex, '').trim());

            // Delete from vault ONLY if it's a voice recording created by this app
            // and we have a vault connection
            const isVoiceRecording = file.name.startsWith('Recording_') && file.mimeType.startsWith('audio/');
            
            if (isVoiceRecording && vaultUri) {
                const { deleteFileByPath } = await import('../utils/saf');
                
                // key logic: reconstruct the path where analyze() saved it
                // We must match the rootFolderForContext logic
                let rootFolderForContext = '';
                if (contextRootFolder && contextRootFolder.trim()) {
                    const exists = await checkDirectoryExists(vaultUri, contextRootFolder.trim());
                    if (exists) rootFolderForContext = contextRootFolder.trim();
                }

                const deletionPath = rootFolderForContext ? `${rootFolderForContext}/${targetPath}` : targetPath;
                await deleteFileByPath(vaultUri, deletionPath);
            }
        } catch (e) {
            console.warn('Failed to remove file from vault during preview cleanup', e);
        }
    };

    const handleRemoveLink = (index: number) => {
        setLinks(prev => prev.filter((_, i) => i !== index));
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

    const handleRemoveAction = (index: number) => {
        if (data?.actions) {
            const newActions = [...data.actions];
            newActions.splice(index, 1);
            setData({ ...data, actions: newActions });
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

        // --- Smart Scheduling Context ---
        setLoadingStatus('Checking Schedule...'); // Update status
        const now = new Date();
        const currentTimeString = now.toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        let scheduleContext = `\n\n--- CONTEXT ---\nCurrent Time: ${currentTimeString}\n`;
        
        try {
            const calendarEvents = await CalendarService.getUpcomingEvents(3); // Next 3 days
            scheduleContext += `\nUpcoming Schedule (Use to find free slots):\n${calendarEvents}\n`;
            


        } catch (e) {
            console.warn('Failed to fetch calendar for context', e);
            scheduleContext += `\n(Could not fetch calendar: ${e})\n`;
        }

        contentForAI += scheduleContext;
        // --------------------------------

        setLoadingStatus('Analyzing content...'); // Update status
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
            // Store structured link metadata
            console.log('[Analyze] Found URLs, setting link state');
            setLinks(prev => {
                // simple de-duplication
                const existingUrls = new Set(prev.map(l => l.url));
                const newLinks = urlMetadata.filter(l => !existingUrls.has(l.url));
                return [...prev, ...newLinks];
            });
        }

        if (urlEmbeds) {
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

            // NOTE: We do NOT prepend URL embeds here anymore.
            // We use links state and prepend them at save time.

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

        const { embeds: urlEmbeds, cleanText, metadata: urlMetadata } = await processURLsInText(processedText);
        
        if (urlMetadata && urlMetadata.length > 0) {
            // In direct save, we also accumulate links
             setLinks(prev => {
                const existingUrls = new Set(prev.map(l => l.url));
                const newLinks = urlMetadata.filter(l => !existingUrls.has(l.url));
                return [...prev, ...newLinks];
            });
        }

        const frontmatter = `---\ntags: [quick_save]\n---\n\n`;
        let content = frontmatter;
        
        // Generate Link Embeds from ALL links (including just detected ones if they were added to state)
        // Note: For direct save, we might just want to use the detected ones + existing ones
        // But state update is async, so we should merge manually for immediate use
        const allLinks = [...links];
        if (urlMetadata) {
             const existingUrls = new Set(links.map(l => l.url));
             urlMetadata.forEach(m => {
                 if (!existingUrls.has(m.url)) allLinks.push(m);
             });
        }

        if (allLinks.length > 0) {
            const { buildObsidianEmbed } = await import('../utils/urlMetadata');
            const linkEmbeds = allLinks.map(l => buildObsidianEmbed(l)).join('\n\n');
            content += linkEmbeds + '\n\n';
        }

        if (cleanText.trim()) content += cleanText + '\n\n';
        if (!urlEmbeds && !cleanText.trim()) {
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
        if (openInObsidian) {
            onReset();
        }
    };

    const handleSave = async (
        overrideTitle?: string,
        overrideFilename?: string,
        overrideFolder?: string,
        overrideBody?: string,
        overrideTags?: string[],
        overrideData?: ProcessedNote,
        forceSkipObsidian?: boolean
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
        let content = frontmatter;

        // Prepend Links
        if (links.length > 0) {
             const { buildObsidianEmbed } = await import('../utils/urlMetadata');
             const linkEmbeds = links.map(l => buildObsidianEmbed(l)).join('\n\n');
             content += linkEmbeds + '\n\n';
        }

        content += targetBody;

        // Execute Actions (Google Calendar Events) - BEFORE opening Obsidian
        if (targetData?.actions && targetData.actions.length > 0) {
            const { accessToken } = useGoogleStore.getState();

            if (accessToken) {
                const { GoogleCalendarService } = await import('../services/googleCalendarService');
                let createdCount = 0;
                for (const action of targetData.actions) {
                    if (action.type === 'create_event') {
                        try {
                            await GoogleCalendarService.createEvent(accessToken, {
                                title: action.title,
                                description: action.description,
                                startTime: action.startTime || new Date().toISOString(),
                                durationMinutes: action.durationMinutes || 30,
                                recurrence: action.recurrence
                            });
                            createdCount++;
                        } catch (e) {
                            console.error('Failed to create event:', e);
                            Alert.alert('Event Creation Failed', `Error: ${e instanceof Error ? e.message : String(e)}`);
                        }
                    }
                }
                if (createdCount > 0) {
                    // Alert.alert('Events Scheduled', `Successfully scheduled ${createdCount} event(s) in Google Calendar.`);
                    // Silent success or maybe a toast? For now, silent is better than a modal.
                }
            } else {
                console.warn('Skipping event creation: No Google Access Token.');
                Alert.alert('Scheduling Skipped', 'No Google Access Token found. Please connect in settings.');
            }
        }
        
        const filePath = await saveToVault(vaultUri, targetFilename, content, targetFolder);
        
        // Only open in Obsidian if:
        // 1. File was saved
        // 2. Open in Obsidian setting is true
        // 3. We are NOT forcefully skipping it (e.g. Save & Add New)
        if (filePath && openInObsidian && !forceSkipObsidian) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await openNoteInObsidian(vaultUri, filePath);
        }



        setSaving(false);
        clearState();
        
        // Only reset (exit app/close share) if we are NOT in "Add New" mode
        if (!forceSkipObsidian && openInObsidian) {
            onReset();
        }
    };

    // Auto-analyze on mount
    useEffect(() => {
        if (!inputMode && (shareIntent?.text || shareIntent?.webUrl)) {
            analyze((shareIntent?.text || shareIntent?.webUrl) ?? '');
        } else {
            setLoading(false);
        }
    }, []);

    const settingsModal = (
        <Modal visible={internalShowSettings} animationType="slide" onRequestClose={() => setInternalShowSettings(false)}>
            <SetupScreen onClose={() => setInternalShowSettings(false)} canClose={true} />
        </Modal>
    );

    // Render screens
    if (loading && !inputMode) return <LoadingScreen message={loadingStatus || "Analyzing..."} />;
    if (saving) return <SavingScreen />;
    if (!data && !loading && !inputMode) return <ErrorScreen onRetry={() => setInputMode(true)} onClose={() => { clearState(); onReset(); }} />;
    
    if (inputMode && !loading) {
        return (
            <>
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
                    onOpenSettings={() => setInternalShowSettings(true)}
                    links={links}
                    onRemoveLink={handleRemoveLink}
                />
                {settingsModal}
            </>
        );
    }

    if (data) {
        return (
            <>
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
                    onSaveAndAddNew={() => handleSave(undefined, undefined, undefined, undefined, undefined, undefined, true)}
                    onBack={() => {
                        setData(null);
                        setInputMode(true);
                    }}
                    saving={saving}
                    vaultUri={vaultUri}
                    onOpenSettings={() => setInternalShowSettings(true)}
                    showTagModal={showTagModal}
                    newTag={newTag}
                    onNewTagChange={setNewTag}
                    onTagModalClose={handleTagModalClose}
                    onTagModalConfirm={handleTagModalConfirm}
                    onRemoveIcon={handleRemoveIcon}
                    onIconChange={handleIconChange}
                    onRemoveFrontmatterKey={handleRemoveFrontmatterKey}
                    onRemoveAction={handleRemoveAction}
                    onAttach={handleAttach}
                    onCamera={handleCamera}
                    onRecord={recording ? stopRecording : startRecording}
                    recording={!!recording}
                    links={links}
                    onRemoveLink={handleRemoveLink}
                />
                {settingsModal}
            </>
        );
    }

    return <LoadingScreen />;
}
