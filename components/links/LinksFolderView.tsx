import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFolderLinks } from '../../hooks/useFolderLinks';
import { LinksList } from './LinksList';
import { LinkService, LinkWithSource } from '../../services/linkService';
import { useSettingsStore } from '../../store/settings';
import Toast from 'react-native-toast-message';

interface LinksFolderViewProps {
    folderUri: string;
    folderPath: string;
}

export function LinksFolderView({ folderUri, folderPath }: LinksFolderViewProps) {
    const { vaultUri } = useSettingsStore();
    const { links, setLinks, isLoading, isRefreshing, loadLinks } = useFolderLinks(folderUri, folderPath);
    const [search, setSearch] = useState('');

    const filteredLinks = links.filter(link => {
        if (!search) return true;
        const q = search.toLowerCase();
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
        setSearch(tag);
    };

    return (
        <View className="flex-1 bg-transparent">
             {/* Search Bar */}
             <View className="px-4 py-2 bg-slate-900/50 border-b border-slate-800">
                <View className="flex-row items-center bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                    <Ionicons name="search" size={18} color="#94a3b8" />
                    <TextInput
                        className="flex-1 ml-2 text-white text-sm"
                        placeholder="Search links..."
                        placeholderTextColor="#64748b"
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <Ionicons
                            name="close-circle"
                            size={18}
                            color="#64748b"
                            onPress={() => setSearch('')}
                        />
                    )}
                </View>
             </View>

            <LinksList
                links={filteredLinks}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                onRefresh={() => loadLinks(true)}
                onDelete={handleDelete}
                onTagPress={handleTagPress}
            />
        </View>
    );
}
