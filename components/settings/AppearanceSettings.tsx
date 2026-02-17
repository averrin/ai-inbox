import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useSettingsStore, ThemeConfig, DEFAULT_THEME } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';

const COLOR_KEYS: (keyof ThemeConfig['colors'])[] = [
    'background', 'surface', 'surfaceHighlight',
    'primary', 'secondary', 'text', 'textSecondary',
    'border', 'success', 'error', 'warning', 'info'
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

        // Live preview: Clone immediately to a "Custom" theme in store to see live changes.
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
                                <View style={{ flex: 1, backgroundColor: t.colors.background }} />
                                <View style={{ flex: 1, backgroundColor: t.colors.surface }} />
                                <View style={{ flex: 1, backgroundColor: t.colors.primary }} />
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

                <View className="mb-4">
                    <Text className="text-text-secondary text-sm mb-1 font-semibold">Theme Name</Text>
                    <TextInput
                        value={themeName}
                        onChangeText={handleNameChange}
                        className="bg-background text-white p-3 rounded-lg border border-border"
                        placeholder="My Cool Theme"
                        placeholderTextColor="#64748b"
                    />
                </View>

                <View className="gap-3">
                    {COLOR_KEYS.map((key) => (
                        <View key={key} className="flex-row items-center justify-between">
                            <Text className="text-text-secondary capitalize w-1/3 text-sm">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Text>
                            <View className="flex-row items-center flex-1 gap-3">
                                <View
                                    className="w-8 h-8 rounded-full border border-white/20 shadow-sm"
                                    style={{ backgroundColor: editingColors[key] }}
                                />
                                <TextInput
                                    value={editingColors[key]}
                                    onChangeText={(text) => handleColorChange(key, text)}
                                    className="flex-1 bg-background text-white p-2 rounded border border-border font-mono text-xs"
                                    maxLength={9} // #RRGGBBAA
                                />
                            </View>
                        </View>
                    ))}
                </View>

                <TouchableOpacity
                    onPress={handleSave}
                    className="mt-6 bg-primary p-4 rounded-xl flex-row justify-center items-center"
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
