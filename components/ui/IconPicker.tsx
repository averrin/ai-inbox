import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Expanded icon library organized by category
export const PRESET_ICONS = [
    // Activity
    'barbell', 'walk', 'bicycle', 'fitness', 'golf', 'trophy', 'ribbon', 'medal',
    // Health
    'heart', 'medkit', 'nutrition', 'water', 'bed', 'body', 'pulse', 'bandage',
    // Media
    'musical-notes', 'videocam', 'camera', 'film', 'mic', 'headset', 'radio', 'tv',
    // Nature
    'leaf', 'flower', 'sunny', 'moon', 'cloudy', 'rainy', 'snow', 'thunderstorm',
    // Tech
    'desktop', 'laptop', 'phone-portrait', 'code', 'terminal', 'game-controller', 'wifi', 'bluetooth',
    // Finance
    'wallet', 'card', 'cash', 'pricetag', 'cart', 'bag', 'gift', 'receipt',
    // Social
    'people', 'person', 'chatbubble', 'mail', 'call', 'share', 'globe', 'earth',
    // Objects
    'book', 'brush', 'pencil', 'key', 'home', 'business', 'briefcase', 'school',
    // Symbols
    'star', 'flag', 'bookmark', 'checkbox', 'time', 'calendar', 'alarm', 'hourglass',
    // Misc
    'pizza', 'cafe', 'beer', 'wine', 'restaurant', 'fast-food', 'ice-cream', 'airplane',
];

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
    icons = PRESET_ICONS,
}: IconPickerProps) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIcons = useMemo(() => {
        if (!searchQuery.trim()) return icons;
        const query = searchQuery.toLowerCase();
        return icons.filter(icon => icon.toLowerCase().includes(query));
    }, [icons, searchQuery]);

    return (
        <View>
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
            <ScrollView 
                style={{ maxHeight: 200 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="flex-row flex-wrap gap-2">
                    {filteredIcons.map(icon => (
                        <TouchableOpacity
                            key={icon}
                            onPress={() => onChange(icon)}
                            className={`w-11 h-11 rounded-xl items-center justify-center border-2 ${
                                value === icon 
                                    ? 'bg-slate-800 border-indigo-500' 
                                    : 'bg-slate-800/50 border-transparent'
                            }`}
                        >
                            <Ionicons 
                                name={icon as any} 
                                size={22} 
                                color={value === icon ? '#818cf8' : '#64748b'} 
                            />
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
            
            {/* Empty State */}
            {filteredIcons.length === 0 && (
                <Text className="text-slate-500 text-center py-4">
                    No icons match "{searchQuery}"
                </Text>
            )}
        </View>
    );
};
