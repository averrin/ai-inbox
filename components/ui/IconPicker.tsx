import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { UniversalIcon } from './UniversalIcon';

// Get all available icons from the glyph map
const ION_ICONS = Object.keys(Ionicons.glyphMap) as string[];
// Filter and map MCI icons
const MCI_ICONS = Object.keys(MaterialCommunityIcons.glyphMap).map(key => `mc/${key}`);

const ALL_ICONS = [...ION_ICONS, ...MCI_ICONS];

interface IconPickerProps {
    value: string;
    onChange: (icon: string) => void;
    label?: string;
    icons?: string[];
}

export const IconPicker = ({
    value,
    onChange,
    label,
    icons = ALL_ICONS,
}: IconPickerProps) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIcons = useMemo(() => {
        if (!searchQuery.trim()) return icons;
        const query = searchQuery.toLowerCase();
        return icons.filter(icon => icon.toLowerCase().includes(query));
    }, [icons, searchQuery]);

    const renderItem = ({ item }: { item: string }) => (
        <TouchableOpacity
            onPress={() => onChange(item)}
            className={`flex-1 m-1 aspect-square items-center justify-center rounded-xl border-2 ${
                value === item
                    ? 'bg-slate-800 border-indigo-500'
                    : 'bg-slate-800/50 border-transparent'
            }`}
        >
            <UniversalIcon
                name={item}
                size={24}
                color={value === item ? '#818cf8' : '#64748b'}
            />
        </TouchableOpacity>
    );

    return (
        <View className="flex-1">
            {label && (
                <Text className="text-indigo-200 mb-2 font-medium">{label}</Text>
            )}
            
            {/* Search Input */}
            <TextInput
                className="bg-slate-800 text-white p-3 rounded-xl border border-slate-700 mb-3"
                placeholder="Search icons..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            
            {/* Icon Grid */}
            <FlatList
                style={{ flex: 1 }}
                data={filteredIcons}
                renderItem={renderItem}
                keyExtractor={item => item}
                numColumns={6}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={24}
                maxToRenderPerBatch={24}
                windowSize={5}
                columnWrapperStyle={{ gap: 4 }}
                ListEmptyComponent={
                    <Text className="text-slate-500 text-center py-4">
                        No icons match "{searchQuery}"
                    </Text>
                }
            />
        </View>
    );
};
