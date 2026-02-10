import React, { useEffect, useState, useRef } from 'react';
import { Alert, Modal } from 'react-native';
import Toast from 'react-native-toast-message';
import { ShareIntent } from 'expo-share-intent';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { useSettingsStore } from '../../store/settings';
import { useGoogleStore } from '../../store/googleStore';
import { processContent, ProcessedNote, transcribeAudio, Action } from '../../services/gemini';
import * as CalendarService from '../../services/calendarService';
import { TasksService } from '../../services/tasksService';
import { syncAllReminders, formatRecurrenceForReminder } from '../../services/reminderService';
import { saveToVault, checkDirectoryExists, readVaultStructure } from '../../utils/saf';
import { openInObsidian as openNoteInObsidian } from '../../utils/obsidian';
import { getMostUsedTags } from '../../utils/tagUtils';
import { processURLsInText, URLMetadata } from '../../utils/urlMetadata';
import { useVaultStore } from '../../services/vaultService';

// Screen components
import { LoadingScreen } from './LoadingScreen';
import SetupScreen from './SetupScreen';
import { ErrorScreen } from './ErrorScreen';
import { SavingScreen } from './SavingScreen';
import { InputScreen } from './InputScreen';
import { PreviewScreen } from './PreviewScreen';
import { EventFormModal, EventSaveData } from '../EventFormModal';

export default function ProcessingScreen({ shareIntent, onReset }: { shareIntent: ShareIntent, onReset: () => void }) {
    const { apiKey, vaultUri, customPromptPath, selectedModel, contextRootFolder, timeFormat } = useSettingsStore();
    const analyzingRef = useRef(false);
    const stateInitializedRef = useRef(false);

    // Main state
    const [loading, setLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [lastError, setLastError] = useState<string | undefined>(undefined);

    // Changed to array
    const [data, setData] = useState<ProcessedNote[] | null>(null);
    const [activeNoteIndex, setActiveNoteIndex] = useState(0);

    const hasShareContent = !!(shareIntent?.text || shareIntent?.webUrl || (shareIntent?.files && shareIntent.files.length > 0));
    const [inputMode, setInputMode] = useState(!hasShareContent);
    const [inputText, setInputText] = useState('');

    // Edit state
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [filename, setFilename] = useState('');
    const [folder, setFolder] = useState('');
    const [body, setBody] = useState('');
    const [folderStatus, setFolderStatus] = useState<'neutral' | 'valid' | 'invalid'>('neutral');

    // Attachment & recording
    const [attachedFiles, setAttachedFiles] = useState<{ uri: string; name: string; size: number; mimeType: string }[]>([]);
    const [links, setLinks] = useState<URLMetadata[]>([]);
    const [recording, setRecording] = useState<Audio.Recording | undefined>();

    // Reminder state
    const [reminderData, setReminderData] = useState<{ date: Date; recurrence: string } | null>(null);
    const [showReminderModal, setShowReminderModal] = useState(false);

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

    // Initialize state from shareIntent props (must run before auto-analyze effect)
    useEffect(() => {
        stateInitializedRef.current = false;

        // Sync inputText from shareIntent
        if (shareIntent?.text || shareIntent?.webUrl) {
            const newText = (shareIntent.text || shareIntent.webUrl) ?? '';
            setInputText(newText);
        }

        // Sync attachedFiles from shareIntent
        if (shareIntent?.files && shareIntent.files.length > 0) {
            const newFiles = shareIntent.files.map((f: any) => ({
                uri: f.uri || f.path,
                name: f.fileName || f.name || 'file',
                size: f.fileSize || f.size || 0,
                mimeType: f.mimeType || 'application/octet-stream'
            }));
            setAttachedFiles(newFiles);
        }

        // Auto-analyze if we have content
        if (shareIntent?.text || shareIntent?.webUrl || (shareIntent?.files && shareIntent.files.length > 0)) {
            const textToAnalyze = (shareIntent.text || shareIntent.webUrl) ?? '';
            // Use a timeout to allow state to settle
            setTimeout(() => {
                analyze(appendTags(textToAnalyze));
            }, 500);
        }

        // Mark state as initialized after state updates have been queued
        // Use a microtask to ensure state setters have been called
        Promise.resolve().then(() => {
            stateInitializedRef.current = true;
        });
    }, [shareIntent]);

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
        setActiveNoteIndex(0);
        setLoading(false);
        setInputMode(true);
        setTitle('');
        setFilename('');
        setFolder('');
        setBody('');
        setTags([]);
        setAttachedFiles([]);
        setLinks([]);
        setLinks([]);
        setSelectedTags([]);
        setReminderData(null);
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
            const { deleteFile } = await import('../../utils/saf');
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
                const { deleteFileByPath } = await import('../../utils/saf');

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

    // Reminder handlers
    const handleReminderClick = () => {
        setShowReminderModal(true);
    };

    const handleReminderSave = (data: EventSaveData) => {
        const recurrence = formatRecurrenceForReminder(data.recurrenceRule) || '';
        setReminderData({ date: data.startDate, recurrence: recurrence });
        setShowReminderModal(false);
    };

    const handleUpdateAction = (index: number, updatedAction: Action) => {
        setData(prevData => {
            if (!prevData) return null;
            const newData = [...prevData];
            if (newData[activeNoteIndex]) {
                if (!newData[activeNoteIndex].actions) {
                    newData[activeNoteIndex].actions = [];
                }
                // Update the specific action
                newData[activeNoteIndex].actions![index] = updatedAction;
            }
            return newData;
        });
    };

    // Tag handlers
    const handleToggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            setSelectedTags(prev => prev.filter(t => t !== tag));
        } else {
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    const handleAddTag = (tag: string) => {
        if (tag.trim()) {
            setTags(prev => [...prev, tag.trim()]);
        }
    };

    const removeTag = (index: number) => setTags(prev => prev.filter((_, i) => i !== index));

    // Icon handlers
    const handleRemoveIcon = () => {
        if (data && data[activeNoteIndex]) {
            const newData = [...data];
            newData[activeNoteIndex] = { ...newData[activeNoteIndex], icon: undefined };
            setData(newData);
        }
    };

    const handleIconChange = (text: string) => {
        if (data && data[activeNoteIndex]) {
            const newData = [...data];
            newData[activeNoteIndex] = { ...newData[activeNoteIndex], icon: text };
            setData(newData);
        }
    };

    const handleRemoveFrontmatterKey = (key: string) => {
        if (data && data[activeNoteIndex]?.frontmatter) {
            const newData = [...data];
            const newFrontmatter = { ...newData[activeNoteIndex].frontmatter };
            delete newFrontmatter[key];
            newData[activeNoteIndex] = { ...newData[activeNoteIndex], frontmatter: newFrontmatter };
            setData(newData);
        }
    };

    const handleUpdateFrontmatter = (updates: Record<string, any>) => {
        if (data && data[activeNoteIndex]) {
            const newData = [...data];
            const newFrontmatter = { ...(newData[activeNoteIndex].frontmatter || {}) };
            Object.entries(updates).forEach(([key, value]) => {
                newFrontmatter[key] = value;
            });
            newData[activeNoteIndex] = { ...newData[activeNoteIndex], frontmatter: newFrontmatter };
            setData(newData);
        }
    };

    const handleRemoveAction = (index: number) => {
        if (data && data[activeNoteIndex]?.actions) {
            const newData = [...data];
            const newActions = [...newData[activeNoteIndex].actions!];
            newActions.splice(index, 1);
            newData[activeNoteIndex] = { ...newData[activeNoteIndex], actions: newActions };
            setData(newData);
        }
    };


    // Analyze & Save
    const analyze = async (text: string, quickSave: boolean = false) => {
        if (analyzingRef.current) return;
        analyzingRef.current = true;
        setLoading(true);

        try {
            // --- 1. Audio Transcription (Pre-analysis) ---
            let transcriptionContext = '';
            let rawTranscriptions = '';
            const { transcribeAudio } = await import('../../services/gemini'); // Moved import here

            if (attachedFiles.length > 0) {
                const audioFiles = attachedFiles.filter(f => f.mimeType.startsWith('audio/'));
                if (audioFiles.length > 0) {
                    setLoadingStatus('Transcribing audio...');

                    const transcriptionPromises = audioFiles.map(async (file) => {
                        try {
                            const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
                            const transcription = await transcribeAudio(apiKey || '', base64, file.mimeType, selectedModel || undefined);
                            return { file, transcription };
                        } catch (e) {
                            console.warn(`Failed to transcribe ${file.name}`, e);
                            return null;
                        }
                    });

                    const results = await Promise.all(transcriptionPromises);
                    for (const result of results) {
                        if (result && result.transcription) {
                            const { file, transcription } = result;
                            // For Note Body (Formatted)
                            const formatted = transcription.split('\n').map(line => `> ${line}`).join('\n');
                            transcriptionContext += `\n> [!quote] Transcription: ${file.name}\n${formatted}\n`;

                            // For AI Prompt (Raw)
                            rawTranscriptions += `\n\nTranscription of ${file.name}:\n${transcription}\n`;
                        }
                    }
                }
            }

            let contentForAI = text;
            if (rawTranscriptions) {
                contentForAI = text.trim() ? `${text}\n${rawTranscriptions}` : rawTranscriptions.trim();
            }

            if (attachedFiles.length > 0) {
                const filesInfo = attachedFiles.map((f, i) => `File ${i + 1}: ${f.name} (${f.mimeType}, ${(f.size / 1024).toFixed(1)} KB)`).join('\n');
                contentForAI = `${filesInfo}\n\n${contentForAI}`;
            }

            // Process URLs in the text (Moved up to determine meaningful text)
            const { embeds: urlEmbeds, cleanText, metadata: urlMetadata } = await processURLsInText(text);

            // --- Smart Scheduling Context ---
            const hasVoiceRecording = attachedFiles.some(f => f.mimeType.startsWith('audio/')); // We assume audio implies voice intent usually
            const hasMeaningfulText = cleanText && cleanText.replace(/#[\w-]+/g, '').trim().length > 0; // Text that isn't just tags or empty

            if (hasVoiceRecording || hasMeaningfulText) {
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
            } else {
                // Even if we skip schedule, current time is useful for file naming (e.g. "Meeting 2023-10...")
                const now = new Date();
                const currentTimeString = now.toLocaleString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                contentForAI += `\n\n--- CONTEXT ---\nCurrent Time: ${currentTimeString}\n`;
            }
            // --------------------------------

            setLoadingStatus('Analyzing content...'); // Update status
            let vaultStructure = '';
            let rootFolderForContext = '';
            if (vaultUri) {
                // Resolve context root just so we have the string for the AI prompt
                if (contextRootFolder && contextRootFolder.trim()) {
                    // Verify it exists (optional, but good for robustness) - actually the store does this too.
                    // To avoid double check, we might just assume it's valid if set, 
                    // OR we check it once here. The store check is for generating structure.
                    // The prompt logic needs the STRING.
                    // Let's rely on the setting being valid-ish. 
                    // But wait, safely getting the targetUri was useful.
                    // Let's re-add the verification significantly faster or just trust the store?
                    // The store returns a Promise<string>. 

                    // Let's just set the variable, we can verify existence via the store call implicitly (store logs error if fails).
                    // But processContent needs to know if we are RELATIVE to usage.
                    // If store returns structure, it succeeded.
                    rootFolderForContext = contextRootFolder.trim();
                }

                vaultStructure = await useVaultStore.getState().getStructure(vaultUri, rootFolderForContext);
            }

            let customPrompt = null;
            if (customPromptPath && customPromptPath.trim()) {
                try {
                    const { readFileContent } = await import('../../utils/saf');
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

            // Process URLs in the text - Already done above

            // Prepare context from URL metadata for AI
            let urlContext = '';
            if (urlMetadata && urlMetadata.length > 0) {
                urlContext = urlMetadata.map(m => `URL: ${m.url}\nTitle: ${m.title}\nDescription: ${m.description || ''}`).join('\n\n');
                setLinks(prev => {
                    const existingUrls = new Set(prev.map(l => l.url));
                    const newLinks = urlMetadata.filter(l => !existingUrls.has(l.url));
                    return [...prev, ...newLinks];
                });
            }

            if (urlEmbeds) {
                // For URL embeds, we rebuild contentForAI more specifically
                // But we must preserve the transcription and file info we added earlier!
                // Let's reconstruct systematically:

                let baseContent = urlContext;
                if (cleanText.trim()) baseContent += `\n\nUser Notes:\n${cleanText}`;
                if (rawTranscriptions) baseContent += rawTranscriptions;

                if (attachedFiles.length > 0) {
                    const { ensurePath, copyFileToFolder } = await import('../../utils/saf');

                    // 1. Pre-ensure all destination folders
                    const uniquePaths = new Set<string>();
                    for (const file of attachedFiles) {
                        const subfolder = getAttachmentSubfolder(file.mimeType);
                        const relativeFolder = `Files/${subfolder}`;
                        const fullFolderPath = rootFolderForContext ? `${rootFolderForContext}/${relativeFolder}` : relativeFolder;
                        uniquePaths.add(fullFolderPath);
                    }

                    const folderUris: Record<string, string> = {};
                    for (const path of uniquePaths) {
                        folderUris[path] = await ensurePath(vaultUri!, path);
                    }

                    // 2. Parallel Copy in Original Order
                    const copyPromises = attachedFiles.map(async (file) => {
                        const subfolder = getAttachmentSubfolder(file.mimeType);
                        const relativeFolder = `Files/${subfolder}`;
                        const fullFolderPath = rootFolderForContext ? `${rootFolderForContext}/${relativeFolder}` : relativeFolder;
                        const folderUri = folderUris[fullFolderPath];

                        const copiedUri = await copyFileToFolder(file.uri, folderUri, file.name);
                        if (copiedUri) {
                            const subfolder = getAttachmentSubfolder(file.mimeType);
                            const targetPath = `Files/${subfolder}/${file.name}`;
                            return `![[${targetPath}]]`;
                        }
                        return null;
                    });

                    const results = await Promise.all(copyPromises);
                    results.forEach(result => {
                        if (result) embeddings.push(result);
                    });

                    // Apply embeddings/transcription to ALL generated notes
                    // Or maybe just the first one? Let's apply to all for now as context is same.
                    // But duplicates are bad. Let's apply to the first note only if logic permits,
                    // or maybe it's better to let user decide.
                    // Actually, the AI might have already distributed content.
                    // But we are appending `embeddings` which are file links.
                    // Let's append to the first note for safety.

                    if (transcriptionContext) {
                        result[0].body = `${transcriptionContext}\n\n${result[0].body}`;
                    }
                    if (embeddings.length > 0) {
                        result[0].body = `${embeddings.join('\n')}\n\n${result[0].body}`;
                    }
                }

                setData(result);
                setActiveNoteIndex(0);

                // Initialize state with first note
                setTitle(result[0].title);
                setFilename(result[0].filename);
                setFolder(result[0].folder);
                setBody(result[0].body);
                setTags(result[0].tags || []);

                if (quickSave) {
                    if (result.length === 1) {
                        await handleSave(
                            result[0].title,
                            result[0].filename,
                            result[0].folder,
                            result[0].body,
                            result[0].tags || [],
                            result[0]
                        );
                    } else {
                        // If multiple notes, disable quick save and show preview
                        Alert.alert('Multiple Notes', 'Multiple notes were generated. Please review them individually.');
                        setLoading(false);
                        setInputMode(false);
                    }
                } else {
                    setLoading(false);
                    setInputMode(false);
                }

            }
        } catch (error: any) {
            console.error('[Analyze] Error:', error);
            // Construct a useful error message
            let errMsg = 'Analysis failed';
            if (error instanceof Error) {
                errMsg = `${error.name}: ${error.message}\n${error.stack || ''}`;
            } else if (typeof error === 'object') {
                errMsg = JSON.stringify(error, null, 2);
            } else {
                errMsg = String(error);
            }
            setLastError(errMsg);
            // Don't use Alert here, let the ErrorScreen show details
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
            const { copyFileToVault } = await import('../../utils/saf');
            const { transcribeAudio } = await import('../../services/gemini');

            const fileProcessingPromises = attachedFiles.map(async (file) => {
                let transcription = null;
                if (file.mimeType.startsWith('audio/')) {
                    try {
                        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
                        transcription = await transcribeAudio(apiKey || '', base64, file.mimeType, selectedModel || undefined);
                    } catch (e) {
                        console.warn(`Failed to transcribe ${file.name}`, e);
                    }
                }

                let embedding = null;
                try {
                    const subfolder = getAttachmentSubfolder(file.mimeType);
                    const targetPath = `Files/${subfolder}/${file.name}`;
                    const copiedUri = await copyFileToVault(file.uri, vaultUri, rootFolderForContext ? `${rootFolderForContext}/${targetPath}` : targetPath);
                    if (copiedUri) embedding = `![[${targetPath}]]`;
                } catch (e) {
                    console.warn(`Failed to copy ${file.name} to vault`, e);
                }

                return { transcription, embedding };
            });

            const results = await Promise.all(fileProcessingPromises);
            for (const res of results) {
                if (res.transcription) {
                    const formatted = res.transcription.split('\n').map(line => `> ${line}`).join('\n');
                    transcriptionText += `\n> [!quote] Transcription\n${formatted}\n`;
                }
                if (res.embedding) {
                    embeddings.push(res.embedding);
                }
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

        // Direct Save Modifications
        const frontmatterEntries: string[] = ['tags: [quick_save]'];

        if (reminderData) {
            frontmatterEntries.push(`reminder_datetime: "${reminderData.date.toISOString()}"`);
            if (reminderData.recurrence) {
                frontmatterEntries.push(`reminder_recurrent: "${reminderData.recurrence}"`);
            }
        }

        const frontmatter = `---\n${frontmatterEntries.join('\n')}\n---\n\n`;
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
            const { buildObsidianEmbed } = await import('../../utils/urlMetadata');
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
        await syncAllReminders();
        clearState();
        if (openInObsidian) {
            onReset();
        }
    };

    // Sync current state back to data array
    const syncCurrentToData = () => {
        if (!data) return;
        const newData = [...data];
        newData[activeNoteIndex] = {
            ...newData[activeNoteIndex],
            title,
            filename,
            folder,
            body,
            tags,
        };
        // Note: icon and actions are updated directly in data
        setData(newData);
    };

    const handleTabChange = (index: number) => {
        if (!data || index < 0 || index >= data.length) return;

        // Save current changes
        syncCurrentToData();

        // Switch index
        setActiveNoteIndex(index);

        // Load new data
        const nextNote = data[index];
        setTitle(nextNote.title);
        setFilename(nextNote.filename);
        setFolder(nextNote.folder);
        setBody(nextNote.body);
        setTags(nextNote.tags || []);
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

        // Determine what we are saving.
        // If overrides are provided, we use them (quick save).
        // Otherwise use current state.
        const targetData = overrideData || (data ? data[activeNoteIndex] : null);
        if (!targetData) return;

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

        // Prepend Links (Only on the first note to avoid duplication if multiple notes?)
        // Or if we want links on all? Let's assume links are relevant to all if split from same source.
        if (links.length > 0) {
            const { buildObsidianEmbed } = await import('../../utils/urlMetadata');
            const linkEmbeds = links.map(l => buildObsidianEmbed(l)).join('\n\n');
            content += linkEmbeds + '\n\n';
        }

        content += targetBody;

        // Execute Actions
        if (targetData?.actions && targetData.actions.length > 0) {
            const { defaultCreateCalendarId } = useSettingsStore.getState();
            let targetCalendarId = defaultCreateCalendarId;

            // If no default create calendar, try to find a writable one
            if (!targetCalendarId) {
                const writableCalendars = await CalendarService.getWritableCalendars();
                if (writableCalendars.length > 0) {
                    targetCalendarId = writableCalendars[0].id;
                }
            }

            if (targetCalendarId) {
                let createdCount = 0;
                let errorOccurred = false;

                for (const action of targetData.actions) {
                    if (action.type === 'create_event') {
                        try {
                            const startTime = action.startTime ? new Date(action.startTime) : new Date();
                            const durationMinutes = action.durationMinutes || 30;
                            const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

                            await CalendarService.createCalendarEvent(targetCalendarId, {
                                title: action.title,
                                description: action.description,
                                startDate: startTime as any, // calendarService handles conversion too but better safe
                                endDate: endTime as any,
                                recurrence: action.recurrence
                            } as any);
                            createdCount++;
                        } catch (e) {
                            console.error('Failed to create event:', e);
                            errorOccurred = true;
                        }
                    }
                }

                if (createdCount > 0) {
                    Toast.show({
                        type: 'success',
                        text1: 'Events Created',
                        text2: `Successfully added ${createdCount} events to your calendar.`
                    });
                }

                if (errorOccurred) {
                    Alert.alert('Some Events Failed', 'One or more events could not be added to your calendar. Please check the logs.');
                }
            } else {
                console.warn('Skipping event creation: No target calendar found.');
                Alert.alert('Scheduling Skipped', 'No writable calendar found. Please check your calendar permissions and settings.');
            }
        }

        const filePath = await saveToVault(vaultUri, targetFilename, content, targetFolder);

        // Handling post-save logic for multiple notes
        if (data && data.length > 1 && !overrideData) {
            // Remove current note from data
            const newData = data.filter((_, i) => i !== activeNoteIndex);
            setData(newData);

            if (newData.length > 0) {
                // Switch to next available note (maintain index if possible, else go to last)
                const nextIndex = activeNoteIndex >= newData.length ? newData.length - 1 : activeNoteIndex;
                setActiveNoteIndex(nextIndex);

                // Load next note
                const nextNote = newData[nextIndex];
                setTitle(nextNote.title);
                setFilename(nextNote.filename);
                setFolder(nextNote.folder);
                setBody(nextNote.body);
                setTags(nextNote.tags || []);

                setSaving(false);
                // Do NOT reset yet, user has more notes to review
                return;
            }
        }

        // Only open in Obsidian if:
        // 1. File was saved
        // 2. Open in Obsidian setting is true
        // 3. We are NOT forcefully skipping it (e.g. Save & Add New)
        if (filePath && openInObsidian && !forceSkipObsidian) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await openNoteInObsidian(vaultUri, filePath);
        }

        await syncAllReminders();

        setSaving(false);
        if (!data || data.length <= 1) { // If it was the last note
            clearState();
            if (!forceSkipObsidian && openInObsidian) {
                onReset();
            }
        }
    };

    // Auto-analyze on mount or intent change
    // This effect depends on inputText and attachedFiles being synced by the initialization effect
    useEffect(() => {
        const hasContent = !!(shareIntent?.text || shareIntent?.webUrl || (shareIntent?.files && shareIntent.files.length > 0));

        if (!hasContent) {
            // Only stop loading if we don't have content and aren't already analyzing
            if (!analyzingRef.current) {
                setLoading(false);
            }
            return;
        }

        // Wait for state initialization to complete to avoid analyzing with stale state
        if (!stateInitializedRef.current) {
            const timer = setTimeout(() => {
                if (stateInitializedRef.current) {
                    const isCleanInput = inputMode && !inputText && attachedFiles.length === 0;
                    if (!inputMode || isCleanInput) {
                        if (isCleanInput) setInputMode(false);
                        analyze((shareIntent?.text || shareIntent?.webUrl) ?? '');
                    } else {
                        setLoading(false);
                    }
                }
            }, 50);
            return () => clearTimeout(timer);
        }

        // Auto-analyze when share content is present and we haven't manually entered input mode
        // OR if content arrived and we were previously "clean" in input mode
        const isCleanInput = inputMode && !inputText && attachedFiles.length === 0;

        if (!inputMode || isCleanInput) {
            if (isCleanInput) setInputMode(false);
            analyze((shareIntent?.text || shareIntent?.webUrl) ?? '');
        } else {
            setLoading(false);
        }
    }, [shareIntent, stateInitializedRef.current]);




    // Render screens
    if (loading && !inputMode) return <LoadingScreen message={loadingStatus || "Analyzing..."} />;
    if (saving) return <SavingScreen />;
    if (!data && !loading && !inputMode) return <ErrorScreen onRetry={() => setInputMode(true)} onClose={() => { clearState(); onReset(); }} errorMessage={lastError} />;

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
                    disabled={loading || saving}
                    links={links}
                    onRemoveLink={handleRemoveLink}
                    onReminder={handleReminderClick}
                    onCreateReminder={handleReminderClick}
                    reminderData={reminderData}
                    onRemoveReminder={() => setReminderData(null)}
                />


                <EventFormModal
                    visible={showReminderModal}
                    initialType="reminder"
                    initialDate={reminderData?.date || new Date()}
                    initialEvent={reminderData ? {
                        originalEvent: {
                            title: title || inputText,
                            recurrenceRule: reminderData.recurrence
                        },
                        title: title || inputText,
                        start: reminderData.date,
                        reminderTime: reminderData.date.toISOString()
                    } : undefined}
                    onSave={handleReminderSave}
                    onCancel={() => setShowReminderModal(false)}
                    timeFormat={timeFormat}
                />
            </>
        );
    }

    if (data && data[activeNoteIndex]) {
        return (
            <>
                <PreviewScreen
                    data={data[activeNoteIndex]}
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
                    onRemoveIcon={handleRemoveIcon}
                    onIconChange={handleIconChange}
                    onRemoveFrontmatterKey={handleRemoveFrontmatterKey}
                    onUpdateFrontmatter={handleUpdateFrontmatter}
                    onRemoveAction={handleRemoveAction}
                    onUpdateAction={handleUpdateAction}
                    onAttach={handleAttach}
                    onCamera={handleCamera}
                    onRecord={recording ? stopRecording : startRecording}
                    recording={!!recording}
                    links={links}
                    onRemoveLink={handleRemoveLink}

                    // Tab props
                    currentTabIndex={activeNoteIndex}
                    totalTabs={data.length}
                    onTabChange={handleTabChange}
                />

            </>
        );
    }

    return <LoadingScreen />;
}
