import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFolderLinks } from '../../hooks/useFolderLinks';
import { LinksList } from './LinksList';
import { LinkService, LinkWithSource } from '../../services/linkService';
import { useSettingsStore } from '../../store/settings';
import Toast from 'react-native-toast-message';
import { Colors } from '../ui/design-tokens';

interface LinksFolderViewProps {
    folderUri: string;
    folderPath: string;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    listPaddingTop?: number;
}

export function LinksFolderView({ folderUri, folderPath, searchQuery, onSearchChange, listPaddingTop }: LinksFolderViewProps) {
    const { vaultUri } = useSettingsStore();
    const { links, setLinks, isLoading, isRefreshing, loadLinks } = useFolderLinks(folderUri, folderPath);

    const filteredLinks = links.filter(link => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (link.title && link.title.toLowerCase().includes(q)) ||
            (link.url && link.url.toLowerCase().includes(q)) ||
            (link.tags && link.tags.some(t => t.toLowerCase().includes(q)))
        );
    });

    const handleDelete = async (link: LinkWithSource) => {
        if (!vaultUri) return;
        try {
            await LinkService.deleteLink(vaultUri, link);
            setLinks(prev => prev.filter(l =>
                !(l.fileUri === link.fileUri && l.blockStartLine === link.blockStartLine)
            ));
            Toast.show({ type: 'success', text1: 'Link Deleted' });
        } catch (e) {
            console.error(e);
            Toast.show({ type: 'error', text1: 'Delete Failed' });
        }
    };

    const handleTagPress = (tag: string) => {
        onSearchChange(tag);
    };

    return (

        <LinksList
            links={filteredLinks}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={() => loadLinks(true)}
            onDelete={handleDelete}
            onTagPress={handleTagPress}
            listPaddingTop={listPaddingTop}
        />
    );
}
