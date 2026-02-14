import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore, NavItemConfig } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export function NavigationSettings() {
    const { navConfig, setNavConfig } = useSettingsStore();

    // Default config for reset
    const DEFAULT_CONFIG: NavItemConfig[] = [
        { id: 'Schedule', visible: true, title: 'Schedule', icon: 'calendar-outline' },
        { id: 'Input', visible: true, title: 'Note', icon: 'create-outline' },
        { id: 'Tasks', visible: true, title: 'Tasks', icon: 'list-outline' },
        { id: 'Links', visible: true, title: 'Links', icon: 'link-outline' },
        { id: 'Reminders', visible: true, title: 'Reminders', icon: 'alarm-outline' },
        { id: 'Jules', visible: true, title: 'Jules', icon: 'logo-github' },
        { id: 'Settings', visible: true, title: 'Settings', icon: 'settings-outline' },
    ];

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newConfig = [...navConfig];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex < 0 || swapIndex >= newConfig.length) return;

        [newConfig[index], newConfig[swapIndex]] = [newConfig[swapIndex], newConfig[index]];
        setNavConfig(newConfig);
    };

    const handleUpdate = (index: number, field: keyof NavItemConfig, value: any) => {
        const newConfig = [...navConfig];
        newConfig[index] = { ...newConfig[index], [field]: value };
        setNavConfig(newConfig);
    };

    const handleReset = () => {
        Alert.alert(
            "Reset Navigation",
            "Are you sure you want to reset the navigation bar to default settings?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Reset",
                    style: "destructive",
                    onPress: () => {
                        setNavConfig(DEFAULT_CONFIG);
                        Toast.show({
                            type: 'success',
                            text1: 'Navigation Reset',
                        });
                    }
                }
            ]
        );
    };

    return (
        <ScrollView>
            <Card>
                <View className="mb-4">
                    <Text className="text-indigo-200 mb-2 font-semibold">Navigation Bar</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Reorder tabs, change icons/titles, or hide pages.
                    </Text>

                    {navConfig.map((item, index) => (
                        <View key={item.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-3">
                            <View className="flex-row items-center justify-between mb-2">
                                <View className="flex-row items-center gap-2">
                                    <TouchableOpacity
                                        onPress={() => handleMove(index, 'up')}
                                        disabled={index === 0}
                                        className={`p-1 rounded ${index === 0 ? 'opacity-30' : 'bg-slate-700'}`}
                                    >
                                        <Ionicons name="arrow-up" size={16} color="white" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleMove(index, 'down')}
                                        disabled={index === navConfig.length - 1}
                                        className={`p-1 rounded ${index === navConfig.length - 1 ? 'opacity-30' : 'bg-slate-700'}`}
                                    >
                                        <Ionicons name="arrow-down" size={16} color="white" />
                                    </TouchableOpacity>
                                    <Text className="text-slate-500 text-xs font-mono ml-2">
                                        {item.id}
                                    </Text>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    <Text className="text-slate-400 text-xs">Visible</Text>
                                    <TouchableOpacity
                                        onPress={() => handleUpdate(index, 'visible', !item.visible)}
                                        className={`w-10 h-6 rounded-full items-center justify-center ${item.visible ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                    >
                                        <View className={`w-4 h-4 bg-white rounded-full absolute ${item.visible ? 'right-1' : 'left-1'}`} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View className="flex-row gap-2">
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-[10px] mb-1 uppercase">Title</Text>
                                    <TextInput
                                        value={item.title}
                                        onChangeText={(text) => handleUpdate(index, 'title', text)}
                                        className="bg-slate-900/50 text-white p-2 rounded-lg border border-slate-700 text-sm"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-[10px] mb-1 uppercase">Icon (Ionicons)</Text>
                                    <View className="flex-row items-center bg-slate-900/50 rounded-lg border border-slate-700 pr-2">
                                        <TextInput
                                            value={item.icon}
                                            onChangeText={(text) => handleUpdate(index, 'icon', text)}
                                            className="flex-1 text-white p-2 text-sm"
                                            autoCapitalize="none"
                                        />
                                        <Ionicons
                                            // @ts-ignore
                                            name={item.icon}
                                            size={20}
                                            color="#818cf8"
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}

                    <View className="mt-4">
                        <Button
                            title="Reset to Defaults"
                            onPress={handleReset}
                            variant="secondary"
                        />
                    </View>
                </View>
            </Card>
        </ScrollView>
    );
}
