import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, ScrollView, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../store/settings';
import { useState, useCallback } from 'react';
import { Article } from '../../services/newsService';
import { useNewsStore } from '../../store/newsStore';
import '../../services/newsService';
import { BaseScreen } from './BaseScreen';
import { islandBaseStyle } from '../ui/IslandBar';
import { MetadataChip } from '../ui/MetadataChip';
import { BaseListItem } from '../ui/BaseListItem';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../ui/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { CloseButton } from '../ui/AppButton';
import { useUIStore } from '../../store/ui';
import { showAlert } from '../../utils/alert';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import { NewsSettings } from '../settings/NewsSettings';

dayjs.extend(relativeTime);

export default function NewsScreen() {
    // keeping useSafeAreaInsets for consistency if needed, but BaseScreen passes it too.
    const insets = useSafeAreaInsets();
    const {
        newsTopics, rssFeeds,
        hiddenArticles, readArticles, hideArticle, markArticleAsRead,
        ignoredHostnames, viewedArticles, markArticleAsViewed, hideArticles,
        newsFilterTerms, newsDefaultViewMode
    } = useSettingsStore();
    const { setFab, clearFab } = useUIStore();

    const { articles: storeArticles, loading } = useNewsStore();
    const [selectedFilter, setSelectedFilter] = useState<string | null>(null); // null = All
    const [customQuery, setCustomQuery] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'list'>(newsDefaultViewMode);
    const [showSettings, setShowSettings] = useState(false);
    const [scrollX, setScrollX] = useState(0);

    // Apply topic/feed filter from chips
    const filteredArticles = storeArticles.filter(a => {
        if (!selectedFilter) return true;
        if (rssFeeds.includes(selectedFilter)) {
            // Match by source name for RSS feeds
            return a.source.name === selectedFilter || a.matchedTopic === selectedFilter;
        }
        // Match by topic
        const text = `${a.title} ${a.description || ''}`.toLowerCase();
        return text.includes(selectedFilter.toLowerCase());
    });

    // Apply custom query filter
    const queriedArticles = (showCustomInput && customQuery.trim())
        ? filteredArticles.filter(a => {
            const text = `${a.title} ${a.description || ''}`.toLowerCase();
            return text.includes(customQuery.trim().toLowerCase());
        })
        : filteredArticles;

    // Derived filtered list to exclude hidden/read articles
    const visibleArticles = queriedArticles.filter(a => {
        const isHidden = hiddenArticles.includes(a.url);
        const isRead = readArticles.some(r => r.url === a.url);
        const isIgnored = ignoredHostnames.some(hostname => {
            try {
                return new URL(a.url).hostname.includes(hostname);
            } catch {
                return false;
            }
        });

        // Filter by terms (case insensitive)
        const combinedText = `${a.title} ${a.description || ''}`.toLowerCase();
        const isBlocked = newsFilterTerms.some(term => combinedText.includes(term.toLowerCase()));

        return !isHidden && !isRead && !isIgnored && !isBlocked;
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

    // Handle Custom Input submission
    const handleCustomSubmit = () => {
        // Filtering is now reactive via customQuery state
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

    const renderRightActions = (item: Article) => {
        // Swipe Left -> Reveal on Right -> Ignore
        return (
            <TouchableOpacity
                className="bg-error justify-center items-center w-20 mb-2 rounded-r-xl"
                onPress={() => hideArticle(item.url)}
            >
                <Ionicons name="eye-off-outline" size={24} color="white" />
                <Text className="text-white text-xs font-bold mt-1">Hide</Text>
            </TouchableOpacity>
        );
    };

    const renderLeftActions = (item: Article) => {
        // Swipe Right -> Reveal on Left -> Read
        return (
            <TouchableOpacity
                className="bg-primary justify-center items-center w-20 mb-2 rounded-l-xl"
                onPress={() => markArticleAsRead({
                    title: item.title,
                    description: item.description,
                    url: item.url,
                    urlToImage: item.urlToImage,
                    publishedAt: item.publishedAt,
                    source: { name: item.source.name, id: item.source.id }
                })}
            >
                <Ionicons name="bookmark" size={24} color="white" />
                <Text className="text-white text-xs font-bold mt-1">Read</Text>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }: { item: Article }) => {
        const isViewed = viewedArticles.includes(item.url);

        if (viewMode === 'list') {
            return (
                <Swipeable
                    renderRightActions={() => renderRightActions(item)}
                    renderLeftActions={() => renderLeftActions(item)}
                    onSwipeableOpen={(direction) => {
                        if (direction === 'left') {
                            // Swiped Right -> Left Actions Revealed -> Read
                            markArticleAsRead({
                                title: item.title,
                                description: item.description,
                                url: item.url,
                                urlToImage: item.urlToImage,
                                publishedAt: item.publishedAt,
                                source: { name: item.source.name, id: item.source.id }
                            });
                        } else if (direction === 'right') {
                            // Swiped Left -> Right Actions Revealed -> Hide
                            hideArticle(item.url);
                        }
                    }}
                    containerStyle={{ overflow: 'visible' }} // Ensure shadows/etc work if needed, though mostly for list items
                >
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
                </Swipeable>
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
        <BaseScreen
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
            searchBar={{
                value: customQuery,
                onChangeText: setCustomQuery,
                placeholder: "Enter custom query...",
                onSubmit: handleCustomSubmit
            }}
            showSearch={showCustomInput}
            onCloseSearch={() => setShowCustomInput(false)}
            headerChildren={
                <View style={[islandBaseStyle, { marginTop: 8, paddingLeft: 4, position: 'relative', marginLeft: 4, marginRight: 4 }]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingLeft: 12, paddingRight: 32, paddingVertical: 4 }}
                        onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
                        scrollEventThrottle={16}
                    >
                        <MetadataChip
                            label="All"
                            variant={(selectedFilter === null && !showCustomInput) ? "solid" : "outline"}
                            color={Colors.status.healthy}
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

                    {/* Left Gradient Fade */}
                    {scrollX > 10 && (
                        <LinearGradient
                            colors={['rgba(30, 41, 59, 1)', 'rgba(30, 41, 59, 0)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, borderTopLeftRadius: 30, borderBottomLeftRadius: 30 }}
                            pointerEvents="none"
                        />
                    )}

                    {/* Right Gradient Fade */}
                    <LinearGradient
                        colors={['rgba(30, 41, 59, 0)', 'rgba(30, 41, 59, 1)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, borderTopRightRadius: 30, borderBottomRightRadius: 30 }}
                        pointerEvents="none"
                    />
                </View>
            }
        >
            {({ insets }) => (
                <View className="flex-1">
                    {(newsTopics.length === 0 && rssFeeds.length === 0) ? (
                        <View className="flex-1 justify-center items-center">
                            <Ionicons name="newspaper-outline" size={64} color="#475569" />
                            <Text className="text-text-tertiary mt-4 text-center">News Configuration Missing.</Text>
                            <Text className="text-secondary text-sm mt-1 text-center">Please configure topics or RSS feeds in Settings.</Text>
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
                                            onRefresh={() => {}}
                                            tintColor="#818cf8"
                                            colors={["#818cf8"]}
                                            progressViewOffset={140}
                                        />
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

                    <Modal
                        visible={showSettings}
                        animationType="slide"
                        presentationStyle="pageSheet"
                        onRequestClose={() => setShowSettings(false)}
                    >
                        <View className="flex-1 bg-background">
                            <View className="flex-row justify-between items-center p-4 border-b border-border bg-surface">
                                <Text className="text-white font-bold text-lg">News Settings</Text>
                                <CloseButton onPress={() => setShowSettings(false)} />
                            </View>
                            <ScrollView contentContainerStyle={{ padding: 16 }}>
                                <NewsSettings />
                            </ScrollView>
                        </View>
                    </Modal>
                </View>
            )}
        </BaseScreen>
    );
}
