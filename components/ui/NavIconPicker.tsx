import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface NavIconPickerProps {
    visible: boolean;
    currentIcon: string;
    onSelect: (iconName: string) => void;
    onClose: () => void;
}

export function NavIconPicker({ visible, currentIcon, onSelect, onClose }: NavIconPickerProps) {
    const insets = useSafeAreaInsets();
    const [search, setSearch] = useState('');

    // @ts-ignore
    const allIcons = useMemo(() => Object.keys(Ionicons.glyphMap), []);

    const filteredIcons = useMemo(() => {
        if (!search) return allIcons;
        const lowerSearch = search.toLowerCase();
        return allIcons.filter(icon => icon.toLowerCase().includes(lowerSearch));
    }, [search, allIcons]);

    const renderItem = ({ item }: { item: string }) => (
        <TouchableOpacity
            onPress={() => {
                onSelect(item);
                onClose();
            }}
            className={`flex-1 m-1 p-4 items-center justify-center rounded-xl border ${item === currentIcon ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700'}`}
            style={{ aspectRatio: 1 }}
        >
            <Ionicons name={item as any} size={24} color="white" />
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-slate-900">
                <View
                    style={{ paddingTop: insets.top + 10 }}
                    className="flex-1 px-4"
                >
                    <View className="flex-row items-center justify-between mb-4">
                        <Text className="text-white text-xl font-bold">Select Icon</Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-800 rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search icons..."
                        placeholderTextColor="#94a3b8"
                        className="bg-slate-800 text-white p-4 rounded-xl border border-slate-700 mb-4"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <FlatList
                        data={filteredIcons}
                        renderItem={renderItem}
                        keyExtractor={item => item}
                        numColumns={4}
                        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={20}
                        maxToRenderPerBatch={20}
                        windowSize={5}
                        removeClippedSubviews={true}
                    />
                </View>
            </View>
        </Modal>
    );
}
