import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useSettingsStore, ThemeConfig, DEFAULT_THEME } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import { ColorPicker } from '../ui/ColorPicker';

const COLOR_GROUPS: { name: string; keys: (keyof ThemeConfig['colors'])[] }[] = [
    {
        name: 'Background Gradient',
        keys: ['gradientStart', 'gradientMiddle', 'gradientEnd']
    },
    {
        name: 'Main Colors',
        keys: ['background', 'surface', 'surfaceHighlight', 'border']
    },
    {
        name: 'Text & Accents',
        keys: ['primary', 'secondary', 'text', 'textSecondary']
    },
    {
        name: 'Status Colors',
        keys: ['success', 'error', 'warning', 'info']
    }
];

export function AppearanceSettings() {
    const { theme, themes, setTheme, saveTheme, deleteTheme, resetTheme } = useSettingsStore();
    const [themeName, setThemeName] = useState(theme.name);
    const [editingColors, setEditingColors] = useState(theme.colors);
    const [isDirty, setIsDirty] = useState(false);

    // Sync when store theme changes (e.g. switching from list)
    useEffect(() => {
        setThemeName(theme.name);
        setEditingColors(theme.colors);
        setIsDirty(false);
    }, [theme.id]);

    const handleColorChange = (key: keyof ThemeConfig['colors'], value: string) => {
        const newColors = { ...editingColors, [key]: value };
        setEditingColors(newColors);
        setIsDirty(true);

        // Live preview
        const previewTheme = {
            ...theme,
            id: theme.id === 'default' ? 'custom-preview' : theme.id,
            name: themeName,
            colors: newColors
        };
        setTheme(previewTheme);
    };

    const handleNameChange = (text: string) => {
        setThemeName(text);
        setIsDirty(true);
    };

    const handleSave = () => {
        const newId = (theme.id === 'default' || theme.id === 'custom-preview')
            ? `theme-${Date.now()}`
            : theme.id;

        const newTheme: ThemeConfig = {
            id: newId,
            name: themeName || 'Untitled Theme',
            colors: editingColors
        };

        saveTheme(newTheme);
        setTheme(newTheme); // Set as active
        setIsDirty(false);
        Alert.alert('Theme Saved', `Theme "${newTheme.name}" saved successfully.`);
    };

    const handleDelete = (id: string) => {
        Alert.alert(
            'Delete Theme',
            'Are you sure you want to delete this theme?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        deleteTheme(id);
                    }
                }
            ]
        );
    };

    return (
        <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }}>
            <View className="mb-6">
                <Text className="text-white text-lg font-bold mb-4">Saved Themes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {themes.map((t) => (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => setTheme(t)}
                            className={`p-4 rounded-xl border mr-3 min-w-[120px] ${
                                theme.id === t.id ? 'border-primary bg-surface-highlight' : 'border-border bg-surface'
                            }`}
                        >
                            <View className="w-full h-12 rounded-lg mb-2 flex-row overflow-hidden border border-white/10">
                                <View style={{ flex: 1, backgroundColor: t.colors.gradientStart }} />
                                <View style={{ flex: 1, backgroundColor: t.colors.gradientMiddle }} />
                                <View style={{ flex: 1, backgroundColor: t.colors.gradientEnd }} />
                            </View>
                            <Text className={`font-medium ${theme.id === t.id ? 'text-primary' : 'text-text-secondary'}`}>
                                {t.name}
                            </Text>
                            {t.id !== 'default' && (
                                <TouchableOpacity
                                    onPress={() => handleDelete(t.id)}
                                    className="absolute top-2 right-2 bg-black/20 rounded-full p-1"
                                >
                                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View className="bg-surface rounded-xl p-4 border border-border mb-6">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-white text-lg font-bold">Edit Active Theme</Text>
                    {isDirty && (
                        <View className="bg-warning/20 px-2 py-1 rounded">
                            <Text className="text-warning text-xs font-bold">Unsaved</Text>
                        </View>
                    )}
                </View>

                <View className="mb-6">
                    <Text className="text-text-secondary text-sm mb-1 font-semibold">Theme Name</Text>
                    <TextInput
                        value={themeName}
                        onChangeText={handleNameChange}
                        className="bg-background text-white p-3 rounded-lg border border-border"
                        placeholder="My Cool Theme"
                        placeholderTextColor="#64748b"
                    />
                </View>

                <View className="gap-6">
                    {COLOR_GROUPS.map((group) => (
                        <View key={group.name} className="gap-3">
                            <Text className="text-white font-bold text-sm uppercase tracking-wider mb-1 border-b border-border pb-1">
                                {group.name}
                            </Text>
                            {group.keys.map((key) => (
                                <View key={key} className="mb-2">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <Text className="text-text-secondary capitalize text-sm">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </Text>
                                        <View className="flex-row items-center gap-2">
                                            <View
                                                className="w-4 h-4 rounded-full border border-white/20"
                                                style={{ backgroundColor: editingColors[key] }}
                                            />
                                            <Text className="text-xs font-mono text-slate-500">{editingColors[key]}</Text>
                                        </View>
                                    </View>
                                    <ColorPicker
                                        value={editingColors[key]}
                                        onChange={(color) => handleColorChange(key, color)}
                                        columns={9}
                                    />
                                </View>
                            ))}
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    className="mt-8 bg-primary p-4 rounded-xl flex-row justify-center items-center"
                >
                    <Ionicons name="save-outline" size={20} color="white" />
                    <Text className="text-white font-bold ml-2">Save Theme</Text>
                </TouchableOpacity>

                 <TouchableOpacity
                    onPress={() => resetTheme()}
                    className="mt-4 bg-surface-highlight border border-border p-4 rounded-xl flex-row justify-center items-center"
                >
                    <Ionicons name="refresh-outline" size={20} color="#94a3b8" />
                    <Text className="text-text-secondary font-bold ml-2">Reset to Default</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
