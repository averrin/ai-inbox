import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, ScrollView, TextInput } from 'react-native';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useRef } from 'react';
import { Article, fetchNews } from '../../services/newsService';
import { Layout } from '../ui/Layout';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as WebBrowser from 'expo-web-browser';

dayjs.extend(relativeTime);

export default function NewsScreen() {
    const { newsTopics, newsApiKey, hiddenArticles, readArticles, hideArticle, markArticleAsRead, ignoredHostnames } = useSettingsStore();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null); // null = All
    const [customQuery, setCustomQuery] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);

    // Derived filtered list to exclude hidden/read articles
    const visibleArticles = articles.filter(a => {
        const isHidden = hiddenArticles.includes(a.url);
        const isRead = readArticles.some(r => r.url === a.url);
        const isIgnored = ignoredHostnames.some(hostname => {
            try {
                return new URL(a.url).hostname.includes(hostname);
            } catch {
                return false;
            }
        });
        return !isHidden && !isRead && !isIgnored;
    });

    const loadNews = async (reset = false) => {
        if (loading) return;
        setLoading(true);
        const targetPage = reset ? 1 : page + 1;

        try {
            let query: string[] = [];

            if (showCustomInput && customQuery.trim()) {
                query = [customQuery.trim()];
            } else if (selectedFilter) {
                query = [selectedFilter];
            } else {
                query = newsTopics;
            }

            const data = await fetchNews(query, newsApiKey, targetPage);

            // Assign badges based on topic matching
            const processedData = data.map(article => {
                const combinedText = `${article.title} ${article.description || ''}`.toLowerCase();
                const matched = newsTopics.find(topic => combinedText.includes(topic.toLowerCase()));
                return matched ? { ...article, matchedTopic: matched } : article;
            });

            if (reset) {
                setArticles(processedData);
                setPage(1);
            } else {
                setArticles(prev => [...prev, ...processedData]);
                setPage(targetPage);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // Reload when filter changes or active query/topics change
    useEffect(() => {
        loadNews(true);
    }, [newsTopics, newsApiKey, selectedFilter, showCustomInput]);

    // Handle Custom Input submission
    const handleCustomSubmit = () => {
        if (customQuery.trim()) {
            loadNews(true);
        }
    };

    const handleOpenArticle = (url: string) => {
        if (url) {
            WebBrowser.openBrowserAsync(url);
        }
    };

    const renderItem = ({ item }: { item: Article }) => (
        <View className="mb-4 bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            <TouchableOpacity onPress={() => handleOpenArticle(item.url)}>
                {item.urlToImage && (
                    <Image
                        source={{ uri: item.urlToImage }}
                        className="w-full h-48"
                        resizeMode="cover"
                    />
                )}
                <View className="p-4">
                    <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-xs text-indigo-400 font-bold uppercase">{item.source.name}</Text>
                            {item.matchedTopic && (
                                <View className="bg-indigo-900/50 px-2 py-0.5 rounded-md border border-indigo-500/30">
                                    <Text className="text-[10px] text-indigo-300 font-medium">{item.matchedTopic}</Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-xs text-slate-500">{dayjs(item.publishedAt).fromNow()}</Text>
                    </View>
                    <Text className="text-white text-lg font-bold mb-2 leading-6">{item.title}</Text>
                    {item.description && (
                        <Text className="text-slate-400 text-sm leading-5" numberOfLines={3}>
                            {item.description}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>

            {/* Action Buttons */}
            <View className="flex-row border-t border-slate-700">
                <TouchableOpacity
                    className="flex-1 p-3 flex-row justify-center items-center border-r border-slate-700"
                    onPress={() => hideArticle(item.url)}
                >
                    <Ionicons name="eye-off-outline" size={20} color="#94a3b8" />
                    <Text className="text-slate-400 ml-2 font-medium">Hide</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-1 p-3 flex-row justify-center items-center"
                    onPress={() => markArticleAsRead({
                        title: item.title,
                        description: item.description,
                        url: item.url,
                        urlToImage: item.urlToImage,
                        publishedAt: item.publishedAt,
                        source: { name: item.source.name, id: item.source.id }
                    })}
                >
                    <Ionicons name="bookmark-outline" size={20} color="#818cf8" />
                    <Text className="text-indigo-400 ml-2 font-medium">Read</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const FilterChip = ({ label, active, onPress }: { label: string, active: boolean, onPress: () => void }) => (
        <TouchableOpacity
            onPress={onPress}
            className={`px-4 py-2 rounded-full mr-2 border ${active ? 'bg-indigo-600 border-indigo-500' : 'bg-slate-800 border-slate-700'}`}
        >
            <Text className={`font-medium ${active ? 'text-white' : 'text-slate-400'}`}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Layout>
            <View className="flex-1 px-4 pt-4">
                <Text className="text-2xl font-bold text-white mb-4">News Feed</Text>

                {(!newsApiKey && !process.env.NEWSAPI_KEY) ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="key-outline" size={64} color="#475569" />
                        <Text className="text-slate-400 mt-4 text-center">News API Key Missing.</Text>
                        <Text className="text-slate-500 text-sm mt-1 text-center">Please configure a News API Key in Settings.</Text>
                    </View>
                ) : (
                    <>
                        {/* Filters Bar */}
                        <View className="mb-4">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-2">
                                <FilterChip
                                    label="All"
                                    active={selectedFilter === null && !showCustomInput}
                                    onPress={() => {
                                        setSelectedFilter(null);
                                        setShowCustomInput(false);
                                    }}
                                />
                                {newsTopics.map(topic => (
                                    <FilterChip
                                        key={topic}
                                        label={topic}
                                        active={selectedFilter === topic && !showCustomInput}
                                        onPress={() => {
                                            setSelectedFilter(topic);
                                            setShowCustomInput(false);
                                        }}
                                    />
                                ))}
                                <FilterChip
                                    label="Custom"
                                    active={showCustomInput}
                                    onPress={() => setShowCustomInput(!showCustomInput)}
                                />
                            </ScrollView>

                            {showCustomInput && (
                                <View className="flex-row items-center gap-2 mb-2">
                                    <TextInput
                                        className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3"
                                        placeholder="Enter custom query..."
                                        placeholderTextColor="#64748b"
                                        value={customQuery}
                                        onChangeText={setCustomQuery}
                                        onSubmitEditing={handleCustomSubmit}
                                        returnKeyType="search"
                                    />
                                    <TouchableOpacity
                                        className="bg-indigo-600 p-3 rounded-xl"
                                        onPress={handleCustomSubmit}
                                    >
                                        <Ionicons name="search" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {newsTopics.length === 0 && !showCustomInput ? (
                            <View className="flex-1 justify-center items-center">
                                <Ionicons name="newspaper-outline" size={64} color="#475569" />
                                <Text className="text-slate-400 mt-4 text-center">No topics configured.</Text>
                                <Text className="text-slate-500 text-sm mt-1 text-center">Go to Settings to add topics.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={visibleArticles}
                                renderItem={renderItem}
                                keyExtractor={(item, index) => `${item.url}-${index}`}
                                contentContainerStyle={{ paddingBottom: 80 }}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={loading}
                                        onRefresh={() => loadNews(true)}
                                        tintColor="#818cf8"
                                        colors={["#818cf8"]}
                                    />
                                }
                                ListFooterComponent={
                                    articles.length > 0 ? (
                                        <View className="p-4 items-center">
                                            <TouchableOpacity
                                                onPress={() => loadNews(false)}
                                                className="bg-slate-800 px-6 py-3 rounded-full border border-slate-700 active:bg-slate-700"
                                                disabled={loading}
                                            >
                                                <Text className="text-slate-300 font-medium">
                                                    {loading ? 'Loading...' : 'Load More'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null
                                }
                                ListEmptyComponent={
                                    !loading ? (
                                        <View className="mt-10 items-center">
                                            <Text className="text-slate-500">No articles found.</Text>
                                        </View>
                                    ) : null
                                }
                            />
                        )}
                    </>
                )}
            </View>
        </Layout>
    );
}
