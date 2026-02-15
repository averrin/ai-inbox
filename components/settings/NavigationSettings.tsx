import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, Modal } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore, NavItemConfig, DEFAULT_NAV_ITEMS } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Crypto from 'expo-crypto';
import { NavIconPicker } from '../ui/NavIconPicker';

export function NavigationSettings() {
    const { navConfig, setNavConfig } = useSettingsStore();
    const [editingGroup, setEditingGroup] = useState<NavItemConfig | null>(null);
    const [iconPickerTarget, setIconPickerTarget] = useState<{ id: string } | null>(null);

    // Filter Config
    const fixedIds = ['Jules', 'Input'];
    const mainItems = navConfig.filter(i => !fixedIds.includes(i.id));
    const actionItems = navConfig.filter(i => fixedIds.includes(i.id));

    // Sort Action Items: Jules first, then Input (to match UI assumption)
    actionItems.sort((a, b) => {
        if (a.id === 'Jules') return -1;
        if (b.id === 'Jules') return 1;
        return 0;
    });

    const updateConfig = (newMain: NavItemConfig[], newActions: NavItemConfig[]) => {
        // Reconstruct full config: Main items first, then Action items
        setNavConfig([...newMain, ...newActions]);
    };

    const handleMoveMain = (index: number, direction: 'up' | 'down') => {
        const newMain = [...mainItems];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex < 0 || swapIndex >= newMain.length) return;

        [newMain[index], newMain[swapIndex]] = [newMain[swapIndex], newMain[index]];
        updateConfig(newMain, actionItems);
    };

    const handleUpdate = (id: string, field: keyof NavItemConfig, value: any) => {
        const newMain = mainItems.map(i => i.id === id ? { ...i, [field]: value } : i);
        const newActions = actionItems.map(i => i.id === id ? { ...i, [field]: value } : i);
        updateConfig(newMain, newActions);
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
        updateConfig([...mainItems, newGroup], actionItems);
    };

    const handleDeleteGroup = (id: string) => {
        const groupIndex = mainItems.findIndex(i => i.id === id);
        if (groupIndex === -1) return;

        const group = mainItems[groupIndex];
        const newMain = [...mainItems];

        if (group.children && group.children.length > 0) {
            // Move children back to root (at end of main list)
            newMain.splice(groupIndex, 1);
            newMain.push(...group.children);
        } else {
            newMain.splice(groupIndex, 1);
        }
        updateConfig(newMain, actionItems);
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
                        setNavConfig(DEFAULT_NAV_ITEMS);
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

        const toggleScreenInGroup = (screenId: string) => {
            // Logic works on global navConfig to find items
            // But we must respect the main/action split constraints?
            // Action items cannot be in groups.
            if (fixedIds.includes(screenId)) return;

            const currentChildren = editingGroup.children || [];
            const isPresent = currentChildren.some(c => c.id === screenId);

            let newChildren: NavItemConfig[];
            let newMain = [...mainItems];

            if (isPresent) {
                // Remove from group, add to root (Main)
                const childToRemove = currentChildren.find(c => c.id === screenId)!;
                newChildren = currentChildren.filter(c => c.id !== screenId);

                if (!newMain.some(i => i.id === screenId)) {
                    newMain.push(childToRemove);
                }
            } else {
                // Add to group, remove from root (Main)
                const screenConfig = newMain.find(i => i.id === screenId);

                if (screenConfig) {
                    newChildren = [...currentChildren, screenConfig];
                    newMain = newMain.filter(i => i.id !== screenId);
                } else {
                    // Item might be in default but not current config?
                    // Or implicitly supported. For now only allow moving from root.
                    return;
                }
            }

            // Update the group itself within newMain
            const groupIndex = newMain.findIndex(i => i.id === editingGroup.id);
            if (groupIndex !== -1) {
                newMain[groupIndex] = { ...newMain[groupIndex], children: newChildren };
                updateConfig(newMain, actionItems);
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
                        {DEFAULT_NAV_ITEMS.filter(s => !fixedIds.includes(s.id)).map(screen => {
                            const isSelected = editingGroup.children?.some(c => c.id === screen.id);
                            // Check if locked in another group
                            const isLocked = !isSelected && !mainItems.some(i => i.id === screen.id) && mainItems.find(i => i.id !== editingGroup.id && i.children?.some(c => c.id === screen.id));

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
                                            name={screen.icon}
                                            size={20}
                                            color={isSelected ? '#818cf8' : '#94a3b8'}
                                        />
                                        <Text className={`font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                            {screen.title}
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

    const renderItem = (item: NavItemConfig, index: number, isAction: boolean) => {
        const isGroup = item.type === 'group';

        return (
            <View key={item.id} className={`border rounded-xl p-3 mb-3 ${isGroup ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-800 border-slate-700'}`}>
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                        {!isAction && (
                            <>
                                <TouchableOpacity
                                    onPress={() => handleMoveMain(index, 'up')}
                                    disabled={index === 0}
                                    className={`p-1 rounded ${index === 0 ? 'opacity-30' : 'bg-slate-700'}`}
                                >
                                    <Ionicons name="arrow-up" size={16} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleMoveMain(index, 'down')}
                                    disabled={index === mainItems.length - 1}
                                    className={`p-1 rounded ${index === mainItems.length - 1 ? 'opacity-30' : 'bg-slate-700'}`}
                                >
                                    <Ionicons name="arrow-down" size={16} color="white" />
                                </TouchableOpacity>
                            </>
                        )}
                        <View className="flex-row items-center">
                            {isGroup && <Ionicons name="folder-outline" size={14} color="#818cf8" style={{ marginRight: 4 }} />}
                            <Text className="text-slate-500 text-xs font-mono ml-1" numberOfLines={1} style={{ maxWidth: 100 }}>
                                {isGroup ? 'Group' : item.id}
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                        {isGroup ? (
                            <View className="flex-row gap-2 items-center">
                                    <TouchableOpacity
                                    onPress={() => setEditingGroup(item)}
                                    className="bg-indigo-600 px-3 py-1 rounded-full h-6 justify-center"
                                >
                                    <Text className="text-white text-xs font-bold">Edit Group</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleDeleteGroup(item.id)}
                                    className="bg-red-500/20 w-6 h-6 items-center justify-center rounded-full"
                                >
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                <Text className="text-slate-400 text-xs">Visible</Text>
                                <TouchableOpacity
                                    onPress={() => handleUpdate(item.id, 'visible', !item.visible)}
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
                        {isAction ? (
                             <View className="bg-slate-900/30 px-3 py-2 h-10 rounded-lg border border-slate-700/50 justify-center">
                                <Text className="text-slate-500 text-sm italic">{item.title}</Text>
                             </View>
                        ) : (
                            <TextInput
                                value={item.title}
                                onChangeText={(text) => handleUpdate(item.id, 'title', text)}
                                className="bg-slate-900/50 text-white px-3 py-2 h-10 rounded-lg border border-slate-700 text-sm"
                            />
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-slate-500 text-[10px] mb-1 uppercase">Icon</Text>
                        {isAction ? (
                            <View className="bg-slate-900/30 px-3 py-2 h-10 rounded-lg border border-slate-700/50 flex-row items-center">
                                <Text className="text-slate-500 text-sm italic flex-1">Custom</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setIconPickerTarget({ id: item.id })}
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
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <ScrollView>
            <Card>
                <View className="mb-6">
                    <Text className="text-indigo-200 mb-2 font-semibold">Main Navigation (Left)</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Reorder tabs, create groups, and customize icons for the left navigation island.
                    </Text>

                    {mainItems.map((item, index) => renderItem(item, index, false))}

                    <Button
                        title="+ Add Group"
                        onPress={handleAddGroup}
                        variant="primary"
                        className="mt-2"
                    />
                </View>

                <View className="mb-4 pt-4 border-t border-slate-700">
                    <Text className="text-indigo-200 mb-2 font-semibold">Action Buttons (Right)</Text>
                    <Text className="text-slate-400 text-sm mb-4">
                        Toggle visibility for fixed action buttons.
                    </Text>

                    {actionItems.map((item, index) => renderItem(item, index, true))}
                </View>

                <View className="mt-4 pt-4 border-t border-slate-700">
                     <Button
                        title="Reset Defaults"
                        onPress={handleReset}
                        variant="secondary"
                    />
                </View>
            </Card>

            {renderGroupEditor()}

            <NavIconPicker
                visible={!!iconPickerTarget}
                currentIcon={iconPickerTarget ? navConfig.find(i => i.id === iconPickerTarget.id)?.icon || '' : ''}
                onSelect={(icon) => {
                    if (iconPickerTarget) {
                        handleUpdate(iconPickerTarget.id, 'icon', icon);
                    }
                }}
                onClose={() => setIconPickerTarget(null)}
            />
        </ScrollView>
    );
}
