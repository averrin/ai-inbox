import React from 'react';
import { FlatList, View, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinkWithSource } from '../../services/linkService';
import { LinkItem } from './LinkItem';

interface LinksListProps {
    links: LinkWithSource[];
    isLoading: boolean;
    isRefreshing: boolean;
    onRefresh: () => void;
    onDelete: (link: LinkWithSource) => void;
    onTagPress: (tag: string) => void;
    listPaddingTop?: number;
}

export function LinksList({ links, isLoading, isRefreshing, onRefresh, onDelete, onTagPress, listPaddingTop = 16 }: LinksListProps) {
    const insets = useSafeAreaInsets();

    if (isLoading && !isRefreshing && links.length === 0) {
        return (
            <View className="flex-1 justify-center items-center" style={{ paddingTop: listPaddingTop }}>
                <ActivityIndicator size="large" color="#818cf8" />
            </View>
        );
    }

    if (!isLoading && links.length === 0) {
        return (
            <View className="flex-1 justify-center items-center p-8" style={{ paddingTop: listPaddingTop }}>
                <Text className="text-text-tertiary text-center text-lg mb-2">No Links Found</Text>
                <Text className="text-secondary text-center">
                    Add links to this folder by sharing them to the app.
                </Text>
            </View>
        );
    }

    return (
        <FlatList
            data={links}
            keyExtractor={(item) => `${item.fileUri}:${item.blockStartLine}`}
            renderItem={({ item }) => (
                <LinkItem link={item} onDelete={onDelete} onTagPress={onTagPress} />
            )}
            contentContainerStyle={{ padding: 16, paddingTop: listPaddingTop, paddingBottom: insets.bottom + 80 }}
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing}
                    onRefresh={onRefresh}
                    tintColor="#818cf8"
                    progressViewOffset={listPaddingTop}
                />
            }
        />
    );
}
