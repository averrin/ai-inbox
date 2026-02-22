import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settings';
import { useState } from 'react';
import { Card } from '../ui/Card';
import { Colors } from '../ui/design-tokens';
import { MetadataChip } from '../ui/MetadataChip';

export function NewsSettings() {
    const {
        newsTopics, setNewsTopics,
        rssFeeds, setRssFeeds,
        newsApiKey, setNewsApiKey,
        ignoredHostnames, setIgnoredHostnames,
        newsFilterTerms, addNewsFilterTerm, removeNewsFilterTerm
    } = useSettingsStore();
    const [newTopic, setNewTopic] = useState('');
    const [newRssFeed, setNewRssFeed] = useState('');
    const [newHostname, setNewHostname] = useState('');
    const [newFilterTerm, setNewFilterTerm] = useState('');

    const handleAddTopic = () => {
        if (newTopic.trim()) {
            if (!newsTopics.includes(newTopic.trim())) {
                setNewsTopics([...newsTopics, newTopic.trim()]);
                setNewTopic('');
            }
        }
    };

    const handleDeleteTopic = (topic: string) => {
        setNewsTopics(newsTopics.filter(t => t !== topic));
    };

    const handleAddRssFeed = () => {
        if (newRssFeed.trim()) {
            if (!rssFeeds.includes(newRssFeed.trim())) {
                setRssFeeds([...rssFeeds, newRssFeed.trim()]);
                setNewRssFeed('');
            }
        }
    };

    const handleDeleteRssFeed = (feed: string) => {
        setRssFeeds(rssFeeds.filter(f => f !== feed));
    };

    const handleAddHostname = () => {
        if (newHostname.trim()) {
            if (!ignoredHostnames.includes(newHostname.trim())) {
                setIgnoredHostnames([...ignoredHostnames, newHostname.trim()]);
                setNewHostname('');
            }
        }
    };

    const handleDeleteHostname = (hostname: string) => {
        setIgnoredHostnames(ignoredHostnames.filter(h => h !== hostname));
    };

    const handleAddFilterTerm = () => {
        const term = newFilterTerm.trim().toLowerCase();
        if (term && !newsFilterTerms.includes(term)) {
            addNewsFilterTerm(term);
            setNewFilterTerm('');
        }
    };

    return (
        <Card>
            <View className="mb-6">
                <Text className="text-text-secondary mb-2 font-semibold">News API Key</Text>
                <TextInput
                    className="bg-background border border-border text-white rounded-xl px-4 py-3 mb-2"
                    placeholder="Enter NewsAPI Key"
                    placeholderTextColor={Colors.secondary}
                    secureTextEntry
                    value={newsApiKey || ''}
                    onChangeText={setNewsApiKey}
                />
                <Text className="text-secondary text-xs">
                    Get your key from <Text className="text-primary underline">newsapi.org</Text>
                </Text>
            </View>

            <View className="mb-4">
                <Text className="text-text-secondary mb-2 font-semibold">Configured Topics</Text>
                <Text className="text-text-tertiary text-sm mb-4">
                    Add topics to customize your news feed.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                    {newsTopics.map((topic) => (
                        <MetadataChip
                            key={topic}
                            label={topic}
                            onRemove={() => handleDeleteTopic(topic)}
                            variant="outline"
                            color={Colors.primary}
                        />
                    ))}
                    {newsTopics.length === 0 && (
                        <Text className="text-secondary italic">No topics added.</Text>
                    )}
                </View>

                <View className="flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-3"
                        placeholder="Add a topic (e.g., Crypto)"
                        placeholderTextColor={Colors.secondary}
                        value={newTopic}
                        onChangeText={setNewTopic}
                        onSubmitEditing={handleAddTopic}
                    />
                    <TouchableOpacity
                        onPress={handleAddTopic}
                        className="bg-primary p-3 rounded-xl"
                        disabled={!newTopic.trim()}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="mb-4">
                <Text className="text-text-secondary mb-2 font-semibold">RSS Feeds</Text>
                <Text className="text-text-tertiary text-sm mb-4">
                    Add RSS feed URLs to include in your news feed.
                </Text>

                <View className="flex-col gap-2 mb-4">
                    {rssFeeds.map((feed) => (
                        <View key={feed} className="bg-surface border border-border rounded-xl px-3 py-2 flex-row items-center justify-between">
                            <Text className="text-white flex-1 mr-2" numberOfLines={1}>{feed}</Text>
                            <TouchableOpacity onPress={() => handleDeleteRssFeed(feed)}>
                                <Ionicons name="close-circle" size={20} color={Colors.error} />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {rssFeeds.length === 0 && (
                        <Text className="text-secondary italic">No RSS feeds added.</Text>
                    )}
                </View>

                <View className="flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-3"
                        placeholder="Add RSS URL"
                        placeholderTextColor={Colors.secondary}
                        value={newRssFeed}
                        onChangeText={setNewRssFeed}
                        onSubmitEditing={handleAddRssFeed}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />
                    <TouchableOpacity
                        onPress={handleAddRssFeed}
                        className="bg-primary p-3 rounded-xl"
                        disabled={!newRssFeed.trim()}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="mb-4">
                <Text className="text-text-secondary mb-2 font-semibold">Ignored Hostnames</Text>
                <Text className="text-text-tertiary text-sm mb-4">
                    Articles from these domains will be hidden.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                    {ignoredHostnames.map((hostname) => (
                        <MetadataChip
                            key={hostname}
                            label={hostname}
                            onRemove={() => handleDeleteHostname(hostname)}
                            variant="outline"
                            color={Colors.error}
                        />
                    ))}
                    {ignoredHostnames.length === 0 && (
                        <Text className="text-secondary italic">No hostnames ignored.</Text>
                    )}
                </View>

                <View className="flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-3"
                        placeholder="Add domain (e.g., example.com)"
                        placeholderTextColor={Colors.secondary}
                        value={newHostname}
                        onChangeText={setNewHostname}
                        onSubmitEditing={handleAddHostname}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TouchableOpacity
                        onPress={handleAddHostname}
                        className="bg-primary p-3 rounded-xl"
                        disabled={!newHostname.trim()}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="mb-4">
                <Text className="text-text-secondary mb-2 font-semibold">Ignored Keywords</Text>
                <Text className="text-text-tertiary text-sm mb-4">
                    Articles containing these words in the title or description will be hidden.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                    {newsFilterTerms.map((term) => (
                        <MetadataChip
                            key={term}
                            label={term}
                            onRemove={() => removeNewsFilterTerm(term)}
                            variant="outline"
                            color={Colors.error}
                        />
                    ))}
                    {newsFilterTerms.length === 0 && (
                        <Text className="text-secondary italic">No keywords ignored.</Text>
                    )}
                </View>

                <View className="flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-3"
                        placeholder="Add word to block..."
                        placeholderTextColor={Colors.secondary}
                        value={newFilterTerm}
                        onChangeText={setNewFilterTerm}
                        onSubmitEditing={handleAddFilterTerm}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity
                        onPress={handleAddFilterTerm}
                        className="bg-primary p-3 rounded-xl"
                        disabled={!newFilterTerm.trim()}
                    >
                        <Ionicons name="add" size={24} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );
}
