import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState, useCallback } from 'react';
import { Article, fetchNews } from '../../services/newsService';
import { Layout } from '../ui/Layout';
import { IslandHeader } from '../ui/IslandHeader';
import { MetadataChip } from '../ui/MetadataChip';
import { BaseListItem } from '../ui/BaseListItem';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../ui/design-tokens';
import { useUIStore } from '../../store/ui';
import { showAlert } from '../../utils/alert';
import { useFocusEffect } from '@react-navigation/native';

dayjs.extend(relativeTime);

export default function NewsScreen() {
    const insets = useSafeAreaInsets();
    const {
        newsTopics, rssFeeds, newsApiKey,
        hiddenArticles, readArticles, hideArticle, markArticleAsRead,
        ignoredHostnames, viewedArticles, markArticleAsViewed, hideArticles
    } = useSettingsStore();
    const { setFab, clearFab } = useUIStore();

    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null); // null = All
    const [customQuery, setCustomQuery] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

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

    useFocusEffect(
        useCallback(() => {
            setFab({
                visible: true,
                icon: showCustomInput ? 'close' : 'add',
                onPress: () => setShowCustomInput(prev => !prev),
            });
            return () => clearFab();
        }, [setFab, clearFab, showCustomInput])
    );

    const loadNews = async (reset = false) => {
        if (loading) return;
        setLoading(true);
        const targetPage = reset ? 1 : page + 1;

        try {
            let topics: string[] = [];
            let feeds: string[] = [];

            if (showCustomInput && customQuery.trim()) {
                topics = [customQuery.trim()];
            } else if (selectedFilter) {
                if (rssFeeds.includes(selectedFilter)) {
                    feeds = [selectedFilter];
                } else {
                    topics = [selectedFilter];
                }
            } else {
                topics = newsTopics;
                feeds = rssFeeds;
            }

            const data = await fetchNews(topics, feeds, newsApiKey, targetPage);

            // Assign badges based on topic matching
            const processedData = data.map(article => {
                const combinedText = `${article.title} ${article.description || ''}`.toLowerCase();
                // Check against newsTopics for badge
                const matched = newsTopics.find(topic => combinedText.includes(topic.toLowerCase()));
                // If not matched by topic, maybe it came from RSS? RSS articles usually have matchedTopic set by service.
                return matched && !article.matchedTopic ? { ...article, matchedTopic: matched } : article;
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

    // Reload when filter changes or active query/topics/feeds change
    useEffect(() => {
        loadNews(true);
    }, [newsTopics, rssFeeds, newsApiKey, selectedFilter, showCustomInput]);

    // Handle Custom Input submission
    const handleCustomSubmit = () => {
        if (customQuery.trim()) {
            loadNews(true);
        }
    };

    const handleOpenArticle = (url: string) => {
        if (url) {
            markArticleAsViewed(url);
            WebBrowser.openBrowserAsync(url);
        }
    };

    const handleReadAll = () => {
        if (visibleArticles.length === 0) return;

        showAlert(
            "Read All",
            "This will hide all currently visible articles. Are you sure?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Hide All",
                    style: "destructive",
                    onPress: () => {
                        const urlsToHide = visibleArticles.map(a => a.url);
                        hideArticles(urlsToHide);
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Article }) => {
        const isViewed = viewedArticles.includes(item.url);

        if (viewMode === 'list') {
            return (
                <BaseListItem
                    title={
                        <Text className={`font-medium ${isViewed ? 'text-text-tertiary' : 'text-white'}`} numberOfLines={2}>
                            {item.title}
                        </Text>
                    }
                    subtitle={
                        <View className="flex-row items-center gap-2">
                            <Text className="text-xs text-primary font-bold uppercase" numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: 100 }}>{item.source.name}</Text>
                            <Text className="text-xs text-secondary">• {dayjs(item.publishedAt).fromNow()}</Text>
                            {item.matchedTopic && (
                                <Text className="text-[10px] text-text-secondary font-medium">• {item.matchedTopic}</Text>
                            )}
                        </View>
                    }
                    onPress={() => handleOpenArticle(item.url)}
                    leftIcon={
                        item.urlToImage ? (
                            <Image
                                source={{ uri: item.urlToImage }}
                                className="w-12 h-12 rounded-lg bg-surface-highlight"
                                resizeMode="cover"
                                style={isViewed ? { opacity: 0.6 } : {}}
                            />
                        ) : (
                            <View className="w-12 h-12 bg-surface-highlight rounded-lg items-center justify-center">
                                <Ionicons name="newspaper-outline" size={24} color={Colors.text.tertiary} />
                            </View>
                        )
                    }
                    hideIconBackground={true}
                    containerStyle={{ marginBottom: 8, opacity: isViewed ? 0.8 : 1 }}
                    rightActions={
                        <View className="flex-row items-center gap-1">
                            <TouchableOpacity
                                onPress={() => markArticleAsRead({
                                    title: item.title,
                                    description: item.description,
                                    url: item.url,
                                    urlToImage: item.urlToImage,
                                    publishedAt: item.publishedAt,
                                    source: { name: item.source.name, id: item.source.id }
                                })}
                                className="p-2"
                            >
                                <Ionicons name="bookmark-outline" size={18} color={Colors.text.tertiary} />
                            </TouchableOpacity>
                        </View>
                    }
                />
            );
        }

        return (
            <View className={`mb-4 bg-surface rounded-xl overflow-hidden border ${isViewed ? 'border-border/50 opacity-75' : 'border-border'}`}>
                <TouchableOpacity onPress={() => handleOpenArticle(item.url)}>
                    {item.urlToImage && (
                        <Image
                            source={{ uri: item.urlToImage }}
                            className="w-full h-48"
                            resizeMode="cover"
                            style={isViewed ? { opacity: 0.8 } : {}}
                        />
                    )}
                    <View className="p-4">
                        <View className="flex-row justify-between items-start mb-2">
                            <View className="flex-row items-center gap-2">
                                <Text className="text-xs text-primary font-bold uppercase" numberOfLines={1} ellipsizeMode="tail" style={{ maxWidth: 150 }}>{item.source.name}</Text>
                                {item.matchedTopic && (
                                    <View className="bg-surface-highlight px-2 py-0.5 rounded-md border border-primary">
                                        <Text className="text-[10px] text-text-secondary font-medium" numberOfLines={1} style={{ maxWidth: 100 }}>{item.matchedTopic}</Text>
                                    </View>
                                )}
                            </View>
                            <Text className="text-xs text-secondary">{dayjs(item.publishedAt).fromNow()}</Text>
                        </View>
                        <Text className={`text-lg font-bold mb-2 leading-6 ${isViewed ? 'text-text-tertiary' : 'text-white'}`}>{item.title}</Text>
                        {item.description && (
                            <Text className="text-text-tertiary text-sm leading-5" numberOfLines={3}>
                                {item.description}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>

                {/* Action Buttons */}
                <View className="flex-row border-t border-border">
                    <TouchableOpacity
                        className="flex-1 p-3 flex-row justify-center items-center border-r border-border"
                        onPress={() => hideArticle(item.url)}
                    >
                        <Ionicons name="eye-off-outline" size={20} color={Colors.text.tertiary} />
                        <Text className="text-text-tertiary ml-2 font-medium">Hide</Text>
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
                        <Text className="text-primary ml-2 font-medium">Read</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Layout>
            <View style={{ position: 'absolute', top: insets.top + 4, left: 16, right: 16, zIndex: 10 }}>
                <IslandHeader
                    title="News Feed"
                    rightActions={[
                        {
                            icon: viewMode === 'list' ? 'grid-outline' : 'list-outline',
                            onPress: () => setViewMode(prev => prev === 'list' ? 'card' : 'list'),
                        },
                        ...(selectedFilter && rssFeeds.includes(selectedFilter) && visibleArticles.length > 0
                            ? [{
                                icon: 'checkmark-done-outline',
                                onPress: handleReadAll,
                            }]
                            : []
                        )
                    ]}
                >
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingVertical: 8 }}
                    >
                        <MetadataChip
                            label="All"
                            variant={(selectedFilter === null && !showCustomInput) ? "solid" : "outline"}
                            color={Colors.primary}
                            onPress={() => {
                                setSelectedFilter(null);
                                setShowCustomInput(false);
                            }}
                        />
                        {newsTopics.map(topic => (
                            <MetadataChip
                                key={topic}
                                label={topic}
                                variant={(selectedFilter === topic && !showCustomInput) ? "solid" : "outline"}
                                color={Colors.primary}
                                onPress={() => {
                                    setSelectedFilter(topic);
                                    setShowCustomInput(false);
                                }}
                            />
                        ))}
                        {rssFeeds.map(feed => {
                            const label = (() => {
                                try {
                                    return new URL(feed).hostname.replace('www.', '');
                                } catch {
                                    return feed;
                                }
                            })();
                            return (
                                <MetadataChip
                                    key={feed}
                                    label={label}
                                    icon="logo-rss"
                                    variant={(selectedFilter === feed && !showCustomInput) ? "solid" : "outline"}
                                    color={Colors.warning}
                                    onPress={() => {
                                        setSelectedFilter(feed);
                                        setShowCustomInput(false);
                                    }}
                                />
                            );
                        })}
                    </ScrollView>

                    {showCustomInput && (
                        <View className="px-1 pb-2 flex-row items-center gap-2">
                            <TextInput
                                className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-2 text-sm"
                                placeholder="Enter custom query..."
                                placeholderTextColor={Colors.secondary}
                                value={customQuery}
                                onChangeText={setCustomQuery}
                                onSubmitEditing={handleCustomSubmit}
                                returnKeyType="search"
                                autoFocus
                            />
                            <TouchableOpacity
                                className="bg-primary p-2 rounded-xl"
                                onPress={handleCustomSubmit}
                            >
                                <Ionicons name="search" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}
                </IslandHeader>
            </View>

            <View className="flex-1 px-4">
                {((!newsApiKey && !process.env.NEWSAPI_KEY) && rssFeeds.length === 0) ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="newspaper-outline" size={64} color="#475569" />
                        <Text className="text-text-tertiary mt-4 text-center">News Configuration Missing.</Text>
                        <Text className="text-secondary text-sm mt-1 text-center">Please configure a News API Key or add RSS feeds in Settings.</Text>
                    </View>
                ) : (
                    <>
                        {newsTopics.length === 0 && rssFeeds.length === 0 && !showCustomInput ? (
                            <View className="flex-1 justify-center items-center" style={{ paddingTop: 140 }}>
                                <Ionicons name="newspaper-outline" size={64} color="#475569" />
                                <Text className="text-text-tertiary mt-4 text-center">No topics or feeds configured.</Text>
                                <Text className="text-secondary text-sm mt-1 text-center">Go to Settings to add topics or RSS feeds.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={visibleArticles}
                                renderItem={renderItem}
                                keyExtractor={(item, index) => `${item.url}-${index}`}
                                contentContainerStyle={{ paddingTop: 140, paddingBottom: insets.bottom + 80 }}
                                refreshControl={
                                    <RefreshControl
                                        refreshing={loading}
                                        onRefresh={() => loadNews(true)}
                                        tintColor="#818cf8"
                                        colors={["#818cf8"]}
                                        progressViewOffset={140}
                                    />
                                }
                                ListFooterComponent={
                                    articles.length > 0 ? (
                                        <View className="p-4 items-center">
                                            <TouchableOpacity
                                                onPress={() => loadNews(false)}
                                                className="bg-surface px-6 py-3 rounded-full border border-border active:bg-surface-highlight"
                                                disabled={loading}
                                            >
                                                <Text className="text-text-secondary font-medium">
                                                    {loading ? 'Loading...' : 'Load More'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null
                                }
                                ListEmptyComponent={
                                    !loading ? (
                                        <View className="mt-10 items-center">
                                            <Text className="text-secondary">No articles found.</Text>
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
