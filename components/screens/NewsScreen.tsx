import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { useSettingsStore } from '../../store/settings';
import { useEffect, useState } from 'react';
import { Article, fetchNews } from '../../services/newsService';
import { Layout } from '../ui/Layout';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as WebBrowser from 'expo-web-browser';

dayjs.extend(relativeTime);

export default function NewsScreen() {
    const { newsTopics } = useSettingsStore();
    const [articles, setArticles] = useState<Article[]>([]);
    const [loading, setLoading] = useState(false);

    const loadNews = async () => {
        setLoading(true);
        try {
            const data = await fetchNews(newsTopics);
            setArticles(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNews();
    }, [newsTopics]); // Reload when topics change

    const handleOpenArticle = (url: string) => {
        if (url) {
            WebBrowser.openBrowserAsync(url);
        }
    };

    const renderItem = ({ item }: { item: Article }) => (
        <TouchableOpacity
            onPress={() => handleOpenArticle(item.url)}
            className="mb-4 bg-slate-800 rounded-xl overflow-hidden border border-slate-700"
        >
            {item.urlToImage && (
                <Image
                    source={{ uri: item.urlToImage }}
                    className="w-full h-48"
                    resizeMode="cover"
                />
            )}
            <View className="p-4">
                <View className="flex-row justify-between items-start mb-2">
                    <Text className="text-xs text-indigo-400 font-bold uppercase">{item.source.name}</Text>
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
    );

    return (
        <Layout>
            <View className="flex-1 px-4 pt-4">
                <Text className="text-2xl font-bold text-white mb-4">News Feed</Text>

                {newsTopics.length === 0 ? (
                    <View className="flex-1 justify-center items-center">
                        <Ionicons name="newspaper-outline" size={64} color="#475569" />
                        <Text className="text-slate-400 mt-4 text-center">No topics configured.</Text>
                        <Text className="text-slate-500 text-sm mt-1 text-center">Go to Settings to add topics.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={articles}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.url}
                        contentContainerStyle={{ paddingBottom: 80 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={loading}
                                onRefresh={loadNews}
                                tintColor="#818cf8"
                                colors={["#818cf8"]}
                            />
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
            </View>
        </Layout>
    );
}
