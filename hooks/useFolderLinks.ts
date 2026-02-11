import { useState, useCallback, useEffect } from 'react';
import { LinkService, LinkWithSource } from '../services/linkService';
import { useSettingsStore } from '../store/settings';
import { useVaultStore } from '../services/vaultService';
import Toast from 'react-native-toast-message';

export function useFolderLinks(folderUri: string, folderPath: string) {
    const { vaultUri, linksRoot } = useSettingsStore();
    const [links, setLinks] = useState<LinkWithSource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadLinks = useCallback(async (refresh = false) => {
        if (!folderUri) return;
        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            // Also refresh vault structure to get latest property suggestions (if applicable)
            if (vaultUri && linksRoot) {
                // We don't await this to avoid blocking UI
                useVaultStore.getState().refreshStructure(vaultUri, linksRoot);
            }
            const result = await LinkService.scanLinksInFolder(folderUri, folderPath);
            setLinks(result);
        } catch (e) {
            console.error('[useFolderLinks] Failed to load links', e);
            Toast.show({
                type: 'error',
                text1: 'Load Failed',
                text2: 'Could not read links from this folder.'
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [folderUri, folderPath, vaultUri, linksRoot]);

    useEffect(() => {
        loadLinks();
    }, [loadLinks]);

    return {
        links,
        setLinks,
        isLoading,
        isRefreshing,
        loadLinks
    };
}
