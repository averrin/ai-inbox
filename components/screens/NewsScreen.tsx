import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState } from 'react';
import { Article, fetchNews } from '../../services/newsService';
import { Layout } from '../ui/Layout';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../ui/design-tokens';

dayjs.extend(relativeTime);

export default function NewsScreen() {
    const insets = useSafeAreaInsets();
    const {
        newsTopics, rssFeeds, newsApiKey,
        hiddenArticles, readArticles, hideArticle, markArticleAsRead,
        ignoredHostnames, viewedArticles, markArticleAsViewed, hideArticles
    } = useSettingsStore();

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

    const FilterChip = ({ label, active, onPress, isRss }: { label: string, active: boolean, onPress: () => void, isRss?: boolean }) => {
        let containerClass = '';
        let textClass = '';

        if (isRss) {
             if (active) {
                 containerClass = 'bg-warning border-warning';
                 textClass = 'text-white';
             } else {
                 containerClass = 'bg-surface border-border';
                 textClass = 'text-warning';
             }
        } else {
             if (active) {
                 containerClass = 'bg-primary border-primary';
                 textClass = 'text-white';
             } else {
                 containerClass = 'bg-surface border-border';
                 textClass = 'text-text-tertiary';
             }
        }

        return (
            <TouchableOpacity
                onPress={onPress}
                className={`px-4 py-2 rounded-full mr-2 mb-2 border ${containerClass}`}
            >
                <Text className={`font-medium ${textClass}`}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <Layout>
            <ScreenHeader
                title="News Feed"
                noBorder
                rightActions={
                    selectedFilter && rssFeeds.includes(selectedFilter) && visibleArticles.length > 0
                        ? [{
                            icon: 'checkmark-done-outline',
                            onPress: handleReadAll,
                            render: () => (
                                <TouchableOpacity
                                    onPress={handleReadAll}
                                    className="flex-row items-center bg-surface px-3 py-1.5 rounded-lg border border-border"
                                >
                                    <Ionicons name="checkmark-done-outline" size={16} color={Colors.text.tertiary} />
                                    <Text className="text-text-secondary text-xs font-bold ml-1">Read All</Text>
                                </TouchableOpacity>
                            ),
                        }]
                        : []
                }
            />
            <View className="flex-1 px-4">

                {((!newsApiKey && !process.env.NEWSAPI_KEY) && rssFeeds.length === 0) ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="newspaper-outline" size={64} color="#475569" />
                        <Text className="text-text-tertiary mt-4 text-center">News Configuration Missing.</Text>
                        <Text className="text-secondary text-sm mt-1 text-center">Please configure a News API Key or add RSS feeds in Settings.</Text>
                    </View>
                ) : (
                    <>
                        {/* Filters Bar */}
                        <View className="mb-4">
                            <View className="flex-row flex-wrap">
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
                                {rssFeeds.map(feed => (
                                    <FilterChip
                                        key={feed}
                                        isRss={true}
                                        label={(() => {
                                            try {
                                                return new URL(feed).hostname.replace('www.', '');
                                            } catch {
                                                return feed;
                                            }
                                        })()}
                                        active={selectedFilter === feed && !showCustomInput}
                                        onPress={() => {
                                            setSelectedFilter(feed);
                                            setShowCustomInput(false);
                                        }}
                                    />
                                ))}
                                <FilterChip
                                    label="Custom"
                                    active={showCustomInput}
                                    onPress={() => setShowCustomInput(!showCustomInput)}
                                />
                            </View>

                            {showCustomInput && (
                                <View className="flex-row items-center gap-2 mb-2">
                                    <TextInput
                                        className="flex-1 bg-background border border-border text-white rounded-xl px-4 py-3"
                                        placeholder="Enter custom query..."
                                        placeholderTextColor={Colors.secondary}
                                        value={customQuery}
                                        onChangeText={setCustomQuery}
                                        onSubmitEditing={handleCustomSubmit}
                                        returnKeyType="search"
                                    />
                                    <TouchableOpacity
                                        className="bg-primary p-3 rounded-xl"
                                        onPress={handleCustomSubmit}
                                    >
                                        <Ionicons name="search" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {newsTopics.length === 0 && rssFeeds.length === 0 && !showCustomInput ? (
                            <View className="flex-1 justify-center items-center">
                                <Ionicons name="newspaper-outline" size={64} color="#475569" />
                                <Text className="text-text-tertiary mt-4 text-center">No topics or feeds configured.</Text>
                                <Text className="text-secondary text-sm mt-1 text-center">Go to Settings to add topics or RSS feeds.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={visibleArticles}
                                renderItem={renderItem}
                                keyExtractor={(item, index) => `${item.url}-${index}`}
                                contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
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
