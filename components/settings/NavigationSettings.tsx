import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, Modal, FlatList } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore, NavItemConfig } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Crypto from 'expo-crypto';
import { NavIconPicker } from '../ui/NavIconPicker';

const ALL_POSSIBLE_SCREENS = [
    { id: 'Schedule', defaultTitle: 'Schedule', defaultIcon: 'calendar-outline' },
    { id: 'Input', defaultTitle: 'Note', defaultIcon: 'create-outline' },
    { id: 'Tasks', defaultTitle: 'Tasks', defaultIcon: 'list-outline' },
    { id: 'Links', defaultTitle: 'Links', defaultIcon: 'link-outline' },
    { id: 'Reminders', defaultTitle: 'Reminders', defaultIcon: 'alarm-outline' },
    { id: 'Jules', defaultTitle: 'Jules', defaultIcon: 'logo-github' },
    { id: 'News', defaultTitle: 'News', defaultIcon: 'newspaper-outline' },
    { id: 'Settings', defaultTitle: 'Settings', defaultIcon: 'settings-outline' },
];

export function NavigationSettings() {
    const { navConfig, setNavConfig } = useSettingsStore();
    const [editingGroup, setEditingGroup] = useState<NavItemConfig | null>(null);
    const [iconPickerTarget, setIconPickerTarget] = useState<{ index: number, isGroupChild?: boolean, childId?: string } | null>(null);

    // Default config for reset
    const DEFAULT_CONFIG: NavItemConfig[] = ALL_POSSIBLE_SCREENS.map(s => ({
        id: s.id,
        visible: true,
        title: s.defaultTitle,
        icon: s.defaultIcon,
        type: 'screen'
    }));

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

    const handleAddGroup = () => {
        const newGroup: NavItemConfig = {
            id: Crypto.randomUUID(),
            type: 'group',
            visible: true,
            title: 'New Group',
            icon: 'grid-outline',
            children: []
        };
        setNavConfig([...navConfig, newGroup]);
    };

    const handleDeleteGroup = (index: number) => {
        const group = navConfig[index];
        if (group.children && group.children.length > 0) {
            // Move children back to root
            const newConfig = [...navConfig];
            newConfig.splice(index, 1);
            setNavConfig([...newConfig, ...group.children]);
        } else {
            const newConfig = [...navConfig];
            newConfig.splice(index, 1);
            setNavConfig(newConfig);
        }
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

    const renderGroupEditor = () => {
        if (!editingGroup) return null;

        // Find which screens are currently available (either at root or inside this group)
        // Actually, we want to allow picking ANY screen.
        // If it's picked here, it moves here.

        const toggleScreenInGroup = (screenId: string) => {
            const currentChildren = editingGroup.children || [];
            const isPresent = currentChildren.some(c => c.id === screenId);

            let newChildren: NavItemConfig[];
            let newRootConfig = [...navConfig];

            if (isPresent) {
                // Remove from group, add to root
                const childToRemove = currentChildren.find(c => c.id === screenId)!;
                newChildren = currentChildren.filter(c => c.id !== screenId);

                // Add back to root if not already there (it shouldn't be)
                if (!newRootConfig.some(i => i.id === screenId)) {
                    newRootConfig.push(childToRemove);
                }
            } else {
                // Add to group, remove from root
                // Find screen config source (root or default)
                let screenConfig = newRootConfig.find(i => i.id === screenId);

                if (!screenConfig) {
                    // Check other groups? For simplicity, only allow stealing from root.
                    // If complex moving is needed, reset first.
                    // Or create from default if missing entirely.
                    const def = ALL_POSSIBLE_SCREENS.find(s => s.id === screenId);
                    if (def) {
                        screenConfig = { ...def, visible: true, type: 'screen' };
                    }
                }

                if (screenConfig) {
                    newChildren = [...currentChildren, screenConfig];
                    newRootConfig = newRootConfig.filter(i => i.id !== screenId);
                } else {
                    return; // Should not happen
                }
            }

            // Update state
            // We need to update both the group inside root config AND the root config itself
            const groupIndex = newRootConfig.findIndex(i => i.id === editingGroup.id);
            if (groupIndex !== -1) {
                newRootConfig[groupIndex] = { ...newRootConfig[groupIndex], children: newChildren };
                setNavConfig(newRootConfig);
                setEditingGroup({ ...editingGroup, children: newChildren });
            }
        };

        return (
            <Modal visible={!!editingGroup} animationType="slide" transparent>
                <View className="flex-1 bg-slate-900 pt-12 px-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">Edit Group: {editingGroup.title}</Text>
                        <TouchableOpacity onPress={() => setEditingGroup(null)} className="p-2 bg-slate-800 rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-slate-400 mb-4">Select screens to include in this group menu.</Text>

                    <ScrollView>
                        {ALL_POSSIBLE_SCREENS.map(screen => {
                            const isSelected = editingGroup.children?.some(c => c.id === screen.id);
                            // Check if screen is in another group (locked)
                            const isLocked = !isSelected && !navConfig.some(i => i.id === screen.id) && navConfig.find(i => i.id !== editingGroup.id && i.children?.some(c => c.id === screen.id));

                            return (
                                <TouchableOpacity
                                    key={screen.id}
                                    onPress={() => !isLocked && toggleScreenInGroup(screen.id)}
                                    className={`p-4 rounded-xl mb-2 border flex-row items-center justify-between ${isSelected ? 'bg-indigo-900/40 border-indigo-500' : 'bg-slate-800 border-slate-700'} ${isLocked ? 'opacity-50' : ''}`}
                                    disabled={!!isLocked}
                                >
                                    <View className="flex-row items-center gap-3">
                                        <Ionicons
                                            // @ts-ignore
                                            name={screen.defaultIcon}
                                            size={20}
                                            color={isSelected ? '#818cf8' : '#94a3b8'}
                                        />
                                        <Text className={`font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                            {screen.defaultTitle}
                                        </Text>
                                    </View>
                                    {!!isLocked && <Text className="text-xs text-slate-500 italic">In another group</Text>}
                                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#818cf8" />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    return (
        <ScrollView>
            <Card>
                <View className="mb-4">
                    <Text className="text-indigo-200 mb-2 font-semibold">Navigation Bar</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Reorder tabs, create groups, and customize icons.
                    </Text>

                    {navConfig.map((item, index) => (
                        <View key={item.id} className={`border rounded-xl p-3 mb-3 ${item.type === 'group' ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-800 border-slate-700'}`}>
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
                                    <View className="flex-row items-center">
                                        {item.type === 'group' && <Ionicons name="folder-outline" size={14} color="#818cf8" style={{ marginRight: 4 }} />}
                                        <Text className="text-slate-500 text-xs font-mono ml-1" numberOfLines={1} style={{ maxWidth: 100 }}>
                                            {item.type === 'group' ? 'Group' : item.id}
                                        </Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-2">
                                    {item.type === 'group' ? (
                                        <View className="flex-row gap-2 items-center">
                                             <TouchableOpacity
                                                onPress={() => setEditingGroup(item)}
                                                className="bg-indigo-600 px-3 py-1 rounded-full h-6 justify-center"
                                            >
                                                <Text className="text-white text-xs font-bold">Edit Group</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleDeleteGroup(index)}
                                                className="bg-red-500/20 w-6 h-6 items-center justify-center rounded-full"
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <>
                                            <Text className="text-slate-400 text-xs">Visible</Text>
                                            <TouchableOpacity
                                                onPress={() => handleUpdate(index, 'visible', !item.visible)}
                                                className={`w-10 h-6 rounded-full items-center justify-center ${item.visible ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                            >
                                                <View className={`w-4 h-4 bg-white rounded-full absolute ${item.visible ? 'right-1' : 'left-1'}`} />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </View>

                            <View className="flex-row gap-2">
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-[10px] mb-1 uppercase">Title</Text>
                                    <TextInput
                                        value={item.title}
                                        onChangeText={(text) => handleUpdate(index, 'title', text)}
                                        className="bg-slate-900/50 text-white px-3 py-2 h-10 rounded-lg border border-slate-700 text-sm"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-slate-500 text-[10px] mb-1 uppercase">Icon</Text>
                                    <TouchableOpacity
                                        onPress={() => setIconPickerTarget({ index })}
                                        className="flex-row items-center bg-slate-900/50 rounded-lg border border-slate-700 px-3 py-2 h-10"
                                    >
                                        <Ionicons
                                            // @ts-ignore
                                            name={item.icon}
                                            size={20}
                                            color="#818cf8"
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text className="text-slate-400 text-sm flex-1" numberOfLines={1}>{item.icon}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    ))}

                    <View className="flex-row gap-3 mt-4">
                        <View className="flex-1">
                            <Button
                                title="+ Add Group"
                                onPress={handleAddGroup}
                                variant="primary"
                            />
                        </View>
                        <View className="flex-1">
                            <Button
                                title="Reset Defaults"
                                onPress={handleReset}
                                variant="secondary"
                            />
                        </View>
                    </View>
                </View>
            </Card>

            {renderGroupEditor()}

            <NavIconPicker
                visible={!!iconPickerTarget}
                currentIcon={iconPickerTarget ? navConfig[iconPickerTarget.index].icon : ''}
                onSelect={(icon) => {
                    if (iconPickerTarget) {
                        handleUpdate(iconPickerTarget.index, 'icon', icon);
                    }
                }}
                onClose={() => setIconPickerTarget(null)}
            />
        </ScrollView>
    );
}
