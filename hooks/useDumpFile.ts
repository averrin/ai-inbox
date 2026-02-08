import { useState, useEffect, useCallback, useRef } from 'react';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/settings';
import { useIsFocused } from '@react-navigation/native';

export const useDumpFile = () => {
    const [content, setContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { vaultUri } = useSettingsStore();
    const isFocused = useIsFocused();
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const currentContentRef = useRef<string>('');

    const getDumpFileUri = useCallback(async () => {
        if (!vaultUri) return null;

        try {
            const files = await StorageAccessFramework.readDirectoryAsync(vaultUri);
            const dumpFile = files.find(f => decodeURIComponent(f).endsWith('dump.md'));

            if (dumpFile) {
                return dumpFile;
            } else {
                // Create if doesn't exist
                return await StorageAccessFramework.createFileAsync(vaultUri, 'dump.md', 'text/markdown');
            }
        } catch (e) {
            console.error('[useDumpFile] Error getting/creating dump file:', e);
            return null;
        }
    }, [vaultUri]);

    const loadContent = useCallback(async () => {
        const fileUri = await getDumpFileUri();
        if (!fileUri) {
            setIsLoading(false);
            return;
        }

        try {
            const data = await StorageAccessFramework.readAsStringAsync(fileUri);
            setContent(data);
            currentContentRef.current = data;
        } catch (e) {
            console.error('[useDumpFile] Error loading content:', e);
        } finally {
            setIsLoading(false);
        }
    }, [getDumpFileUri]);

    const saveContent = useCallback(async (newContent: string) => {
        const fileUri = await getDumpFileUri();
        if (!fileUri) return;

        try {
            await StorageAccessFramework.writeAsStringAsync(fileUri, newContent);
            currentContentRef.current = newContent;
        } catch (e) {
            console.error('[useDumpFile] Error saving content:', e);
        }
    }, [getDumpFileUri]);

    // Load on mount and focus
    useEffect(() => {
        if (isFocused) {
            loadContent();
        }
    }, [isFocused, loadContent]);

    // Auto-save on change (debounced)
    const onContentChange = useCallback((newContent: string) => {
        setContent(newContent);

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            saveContent(newContent);
        }, 2000);
    }, [saveContent]);

    // Immediate save on unmount or blur
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
                saveContent(content);
            }
        };
    }, [content, saveContent]);

    return {
        content,
        onContentChange,
        isLoading,
        refresh: loadContent,
    };
};
