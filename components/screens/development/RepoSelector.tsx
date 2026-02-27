import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GithubRepo, fetchGithubRepos } from '../../../services/jules';
import { Colors } from '../../ui/design-tokens';

interface RepoSelectorProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (repo: GithubRepo) => void;
    token: string;
}

export function RepoSelector({ visible, onClose, onSelect, token }: RepoSelectorProps) {
    const [repos, setRepos] = useState<GithubRepo[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && token) {
            setLoading(true);
            setSearch('');
            fetchGithubRepos(token)
                .then(setRepos)
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [visible, token]);

    const filtered = repos.filter(r => r.full_name.toLowerCase().includes(search.toLowerCase()));

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View className="flex-1 bg-black/80 justify-center px-4">
                <View className="bg-background rounded-2xl max-h-[80%] overflow-hidden w-full border border-border">
                    <View className="p-4 border-b border-border flex-row justify-between items-center bg-surface">
                        <Text className="text-white font-bold text-lg">Select Repository</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <View className="p-4 bg-background">
                        <View className="bg-surface rounded-lg flex-row items-center px-3 mb-2 border border-border">
                            <Ionicons name="search" size={20} color={Colors.text.tertiary} />
                            <TextInput
                                className="flex-1 text-white p-3"
                                placeholder="Search repositories..."
                                placeholderTextColor={Colors.text.tertiary}
                                value={search}
                                onChangeText={setSearch}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>
                    {loading ? (
                        <ActivityIndicator size="large" color="#818cf8" className="my-10" />
                    ) : (
                        <FlatList
                            data={filtered}
                            keyExtractor={item => item.id.toString()}
                            className="bg-background"
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    className="p-4 border-b border-border flex-row items-center justify-between"
                                    onPress={() => onSelect(item)}
                                >
                                    <View className="flex-1 mr-2">
                                        <Text className="text-white font-medium text-base">{item.full_name}</Text>
                                        {item.description && <Text className="text-secondary text-xs" numberOfLines={1}>{item.description}</Text>}
                                    </View>
                                    {item.private && <Ionicons name="lock-closed" size={14} color={Colors.text.tertiary} />}
                                </TouchableOpacity>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
