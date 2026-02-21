import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore, NavItemConfig, DEFAULT_NAV_ITEMS } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Crypto from 'expo-crypto';
import { NavIconPicker } from '../ui/NavIconPicker';
import { Colors } from '../ui/design-tokens';
import { showAlert } from '../../utils/alert';

export function NavigationSettings() {
    const { navConfig, setNavConfig, savedNavConfig, setSavedNavConfig } = useSettingsStore();
    const [editingGroup, setEditingGroup] = useState<NavItemConfig | null>(null);
    const [iconPickerTarget, setIconPickerTarget] = useState<{ id: string } | null>(null);

    // Filter Config by Segment
    const leftItems = navConfig.filter(i => i.segment !== 'right');
    const rightItems = navConfig.filter(i => i.segment === 'right');

    // Calculate Missing Items (Available to Add)
    // Check if an item from DEFAULT_NAV_ITEMS is present in navConfig (either at root or inside a group)
    const isItemInConfig = (id: string, config: NavItemConfig[]): boolean => {
        return config.some(item => {
            if (item.id === id) return true;
            if (item.children) return isItemInConfig(id, item.children);
            return false;
        });
    };

    const missingItems = DEFAULT_NAV_ITEMS.filter(def => !isItemInConfig(def.id, navConfig));

    const updateConfig = (newLeft: NavItemConfig[], newRight: NavItemConfig[]) => {
        // Reconstruct full config
        setNavConfig([...newLeft, ...newRight]);
    };

    const handleMove = (id: string, direction: 'up' | 'down') => {
        const isRight = rightItems.some(i => i.id === id);
        const list = isRight ? [...rightItems] : [...leftItems];
        const index = list.findIndex(i => i.id === id);

        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex < 0 || swapIndex >= list.length) return;

        [list[index], list[swapIndex]] = [list[swapIndex], list[index]];

        if (isRight) updateConfig(leftItems, list);
        else updateConfig(list, rightItems);
    };

    const handleSwitchSegment = (id: string) => {
        const item = navConfig.find(i => i.id === id);
        if (!item) return;

        const isRight = item.segment === 'right';
        const newSegment = isRight ? 'left' : 'right';

        const newItem = { ...item, segment: newSegment as 'left' | 'right' };

        // Remove from old list, add to new list
        const newLeft = isRight ? [...leftItems, newItem] : leftItems.filter(i => i.id !== id);
        const newRight = isRight ? rightItems.filter(i => i.id !== id) : [...rightItems, newItem];

        updateConfig(newLeft, newRight);
    };

    const handleUpdate = (id: string, field: keyof NavItemConfig, value: any) => {
        const newConfig = navConfig.map(i => i.id === id ? { ...i, [field]: value } : i);
        setNavConfig(newConfig);
    };

    const handleAddGroup = (segment: 'left' | 'right') => {
        const newGroup: NavItemConfig = {
            id: Crypto.randomUUID(),
            type: 'group',
            visible: true,
            title: 'New Group',
            icon: 'grid-outline',
            children: [],
            segment
        };
        setNavConfig([...navConfig, newGroup]);
    };

    const handleAddScreen = (screen: NavItemConfig) => {
        // Add to 'left' by default, or append to end
        // We clone the default item to ensure clean state
        const newItem: NavItemConfig = {
            ...screen,
            segment: 'left', // Default to left
            visible: true
        };
        setNavConfig([...navConfig, newItem]);
    };

    const handleDelete = (id: string) => {
        const index = navConfig.findIndex(i => i.id === id);
        if (index === -1) return;

        const item = navConfig[index];
        const newConfig = [...navConfig];

        if (item.children && item.children.length > 0) {
            // Move children back to root (in same segment)
            const childrenWithSegment = item.children.map(c => ({ ...c, segment: item.segment }));
            newConfig.splice(index, 1, ...childrenWithSegment);
        } else {
            newConfig.splice(index, 1);
        }
        setNavConfig(newConfig);
    };

    const handleSaveAsDefault = () => {
        setSavedNavConfig(navConfig);
        Toast.show({
            type: 'success',
            text1: 'Layout Saved as Default',
            text2: 'You can restore this layout later.'
        });
    };

    const handleReset = () => {
        const options: AlertButton[] = [
            { text: "Cancel", style: "cancel" },
            {
                text: "Factory Reset",
                style: "destructive",
                onPress: () => {
                    setNavConfig(DEFAULT_NAV_ITEMS);
                    Toast.show({
                        type: 'success',
                        text1: 'Reset to Factory Defaults',
                    });
                }
            }
        ];

        if (savedNavConfig) {
            options.splice(1, 0, {
                text: "Restore My Defaults",
                style: "default",
                onPress: () => {
                    setNavConfig(savedNavConfig);
                    Toast.show({
                        type: 'success',
                        text1: 'Restored Your Defaults',
                    });
                }
            });
        }

        showAlert(
            "Reset Navigation",
            "Choose how you want to reset the navigation bar.",
            options
        );
    };

    const handleGroupChildMove = (childId: string, direction: 'up' | 'down') => {
        if (!editingGroup || !editingGroup.children) return;
        const list = [...editingGroup.children];
        const index = list.findIndex(i => i.id === childId);

        const swapIndex = direction === 'up' ? index - 1 : index + 1;

        if (swapIndex < 0 || swapIndex >= list.length) return;

        [list[index], list[swapIndex]] = [list[swapIndex], list[index]];

        // Update group and navConfig
        const newGroup = { ...editingGroup, children: list };
        setEditingGroup(newGroup);

        const newNavConfig = navConfig.map(i => i.id === newGroup.id ? newGroup : i);
        setNavConfig(newNavConfig);
    };

    const handleGroupChildUpdate = (childId: string, field: keyof NavItemConfig, value: any) => {
        if (!editingGroup || !editingGroup.children) return;
        const newChildren = editingGroup.children.map(c => c.id === childId ? { ...c, [field]: value } : c);

        const newGroup = { ...editingGroup, children: newChildren };
        setEditingGroup(newGroup);

        const newNavConfig = navConfig.map(i => i.id === newGroup.id ? newGroup : i);
        setNavConfig(newNavConfig);
    };

    const handleRemoveFromGroup = (childId: string) => {
        if (!editingGroup || !editingGroup.children) return;

        const childToRemove = editingGroup.children.find(c => c.id === childId);
        if (!childToRemove) return;

        // Remove from group
        const newChildren = editingGroup.children.filter(c => c.id !== childId);
        const newGroup = { ...editingGroup, children: newChildren };

        // Add to root (inheriting segment from group)
        const newRootItem = { ...childToRemove, segment: editingGroup.segment };

        let newNavConfig = navConfig.map(i => i.id === newGroup.id ? newGroup : i);

        // Ensure not duplicate in root
        if (!newNavConfig.some(i => i.id === childId)) {
            newNavConfig.push(newRootItem);
        }

        setEditingGroup(newGroup);
        setNavConfig(newNavConfig);
    };

    const handleAddToGroup = (item: NavItemConfig) => {
        if (!editingGroup) return;

        // Remove from root (if exists there)
        // Note: item passed might be from DEFAULT_NAV_ITEMS so check by ID in navConfig
        const existingInRoot = navConfig.find(i => i.id === item.id);

        // Use the existing config if found (to preserve custom titles/icons), else use the default item
        const itemToAdd = existingInRoot || item;

        let newNavConfig = navConfig.filter(i => i.id !== item.id);

        // Add to group children
        const currentChildren = editingGroup.children || [];
        // Ensure not duplicate
        if (currentChildren.some(c => c.id === item.id)) return;

        const newChildren = [...currentChildren, itemToAdd];
        const newGroup = { ...editingGroup, children: newChildren };

        // Update group in config
        const groupIndex = newNavConfig.findIndex(i => i.id === editingGroup.id);
        if (groupIndex !== -1) {
             newNavConfig[groupIndex] = newGroup;
        }

        setEditingGroup(newGroup);
        setNavConfig(newNavConfig);
    };

    const renderGroupEditor = () => {
        if (!editingGroup) return null;

        const currentChildren = editingGroup.children || [];

        // Items available to add: Not in current group and not in any other group
        const availableItems = DEFAULT_NAV_ITEMS.filter(screen => {
            const inCurrentGroup = currentChildren.some(c => c.id === screen.id);
            if (inCurrentGroup) return false;

            // Check if in another group
            const inAnotherGroup = navConfig.some(item =>
                item.id !== editingGroup.id &&
                item.children?.some(c => c.id === screen.id)
            );

            return !inAnotherGroup;
        });

        return (
            <Modal visible={!!editingGroup} animationType="slide" transparent>
                <View className="flex-1 bg-background pt-12 px-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">Edit Group: {editingGroup.title}</Text>
                        <TouchableOpacity onPress={() => setEditingGroup(null)} className="p-2 bg-surface rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView>
                        <Text className="text-text-secondary mb-2 font-semibold uppercase text-xs">Items in Group</Text>
                        {currentChildren.length === 0 ? (
                            <Text className="text-text-tertiary italic mb-4">No items in this group.</Text>
                        ) : (
                            currentChildren.map((item, index) => (
                                <View key={item.id} className="bg-surface border border-border rounded-xl p-3 mb-3">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center gap-2">
                                            <TouchableOpacity
                                                onPress={() => handleGroupChildMove(item.id, 'up')}
                                                disabled={index === 0}
                                                className={`p-1 rounded ${index === 0 ? 'opacity-30' : 'bg-surface-highlight'}`}
                                            >
                                                <Ionicons name="arrow-up" size={16} color="white" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleGroupChildMove(item.id, 'down')}
                                                disabled={index === currentChildren.length - 1}
                                                className={`p-1 rounded ${index === currentChildren.length - 1 ? 'opacity-30' : 'bg-surface-highlight'}`}
                                            >
                                                <Ionicons name="arrow-down" size={16} color="white" />
                                            </TouchableOpacity>

                                            <Text className="text-secondary text-xs font-mono ml-1" numberOfLines={1} style={{ maxWidth: 120 }}>
                                                {item.id}
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => handleRemoveFromGroup(item.id)}
                                            className="bg-error/20 w-8 h-8 items-center justify-center rounded-full"
                                        >
                                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                                        </TouchableOpacity>
                                    </View>

                                    <View className="flex-row gap-2">
                                        <View className="flex-1">
                                            <Text className="text-secondary text-[10px] mb-1 uppercase">Title</Text>
                                            <TextInput
                                                value={item.title}
                                                onChangeText={(text) => handleGroupChildUpdate(item.id, 'title', text)}
                                                className="bg-background/50 text-white px-3 py-2 h-10 rounded-lg border border-border text-sm"
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-secondary text-[10px] mb-1 uppercase">Icon</Text>
                                            <TouchableOpacity
                                                onPress={() => setIconPickerTarget({ id: item.id })}
                                                className="flex-row items-center bg-background/50 rounded-lg border border-border px-3 py-2 h-10"
                                            >
                                                <Ionicons
                                                    // @ts-ignore
                                                    name={item.icon}
                                                    size={20}
                                                    color="#818cf8"
                                                    style={{ marginRight: 8 }}
                                                />
                                                <Text className="text-text-tertiary text-sm flex-1" numberOfLines={1}>{item.icon}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}

                        <View className="mt-4 pt-4 border-t border-border">
                            <Text className="text-text-secondary mb-2 font-semibold uppercase text-xs">Available Items</Text>
                             <View className="flex-row flex-wrap gap-2">
                                {availableItems.map(screen => (
                                    <TouchableOpacity
                                        key={screen.id}
                                        onPress={() => handleAddToGroup(screen)}
                                        className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2 mb-2"
                                    >
                                        <Ionicons name="add" size={16} color="#818cf8" style={{ marginRight: 4 }} />
                                        <Text className="text-text-secondary text-sm">{screen.title}</Text>
                                    </TouchableOpacity>
                                ))}
                                {availableItems.length === 0 && (
                                    <Text className="text-text-tertiary italic">No other items available.</Text>
                                )}
                            </View>
                        </View>

                        <View className="h-20" />
                    </ScrollView>
                </View>
            </Modal>
        );
    };

    const renderItem = (item: NavItemConfig, index: number, listLength: number) => {
        const isGroup = item.type === 'group';
        const isRight = item.segment === 'right';

        return (
            <View key={item.id} className={`border rounded-xl p-3 mb-3 ${isGroup ? 'bg-surface-highlight border-primary' : 'bg-surface border-border'}`}>
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                            onPress={() => handleMove(item.id, 'up')}
                            disabled={index === 0}
                            className={`p-1 rounded ${index === 0 ? 'opacity-30' : 'bg-surface-highlight'}`}
                        >
                            <Ionicons name="arrow-up" size={16} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleMove(item.id, 'down')}
                            disabled={index === listLength - 1}
                            className={`p-1 rounded ${index === listLength - 1 ? 'opacity-30' : 'bg-surface-highlight'}`}
                        >
                            <Ionicons name="arrow-down" size={16} color="white" />
                        </TouchableOpacity>

                        <View className="flex-row items-center">
                            {isGroup && <Ionicons name="folder-outline" size={14} color="#818cf8" style={{ marginRight: 4 }} />}
                            <Text className="text-secondary text-xs font-mono ml-1" numberOfLines={1} style={{ maxWidth: 100 }}>
                                {isGroup ? 'Group' : item.id}
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                             onPress={() => handleSwitchSegment(item.id)}
                             className="bg-surface-highlight px-2 py-1 rounded"
                        >
                             <Text className="text-xs text-white">Move to {isRight ? 'Left' : 'Right'}</Text>
                        </TouchableOpacity>

                        {isGroup ? (
                            <View className="flex-row gap-2 items-center">
                                    <TouchableOpacity
                                    onPress={() => setEditingGroup(item)}
                                    className="bg-primary px-3 py-1 rounded-full h-6 justify-center"
                                >
                                    <Text className="text-white text-xs font-bold">Edit</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            className="bg-error/20 w-8 h-8 items-center justify-center rounded-full ml-1"
                        >
                            <Ionicons name="trash-outline" size={18} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="flex-row gap-2">
                    <View className="flex-1">
                        <Text className="text-secondary text-[10px] mb-1 uppercase">Title</Text>
                        <TextInput
                            value={item.title}
                            onChangeText={(text) => handleUpdate(item.id, 'title', text)}
                            className="bg-background/50 text-white px-3 py-2 h-10 rounded-lg border border-border text-sm"
                        />
                    </View>
                    <View className="flex-1">
                        <Text className="text-secondary text-[10px] mb-1 uppercase">Icon</Text>
                        <TouchableOpacity
                            onPress={() => setIconPickerTarget({ id: item.id })}
                            className="flex-row items-center bg-background/50 rounded-lg border border-border px-3 py-2 h-10"
                        >
                            <Ionicons
                                // @ts-ignore
                                name={item.icon}
                                size={20}
                                color="#818cf8"
                                style={{ marginRight: 8 }}
                            />
                            <Text className="text-text-tertiary text-sm flex-1" numberOfLines={1}>{item.icon}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <ScrollView>
            <Card>
                <View className="mb-6">
                    <Text className="text-text-secondary mb-2 font-semibold">Left Segment</Text>
                    {leftItems.map((item, index) => renderItem(item, index, leftItems.length))}

                    <Button
                        title="+ Add Group (Left)"
                        onPress={() => handleAddGroup('left')}
                        variant="primary"
                        className="mt-2"
                    />
                </View>

                <View className="mb-4 pt-4 border-t border-border">
                    <Text className="text-text-secondary mb-2 font-semibold">Right Segment</Text>
                    {rightItems.map((item, index) => renderItem(item, index, rightItems.length))}

                     <Button
                        title="+ Add Group (Right)"
                        onPress={() => handleAddGroup('right')}
                        variant="primary"
                        className="mt-2"
                    />
                </View>

                {missingItems.length > 0 && (
                    <View className="mb-4 pt-4 border-t border-border">
                        <Text className="text-text-secondary mb-2 font-semibold">Available Screens</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {missingItems.map(screen => (
                                <TouchableOpacity
                                    key={screen.id}
                                    onPress={() => handleAddScreen(screen)}
                                    className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2"
                                >
                                    <Ionicons name="add" size={16} color="#818cf8" style={{ marginRight: 4 }} />
                                    <Text className="text-text-secondary text-sm">{screen.title}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View className="mt-4 pt-4 border-t border-border flex-row gap-2">
                     <View className="flex-1">
                        <Button
                            title="Reset..."
                            onPress={handleReset}
                            variant="secondary"
                        />
                     </View>
                     <View className="flex-1">
                        <Button
                            title="Save as Default"
                            onPress={handleSaveAsDefault}
                            variant="primary"
                        />
                     </View>
                </View>
            </Card>

            {renderGroupEditor()}

            <NavIconPicker
                visible={!!iconPickerTarget}
                currentIcon={(() => {
                    if (!iconPickerTarget) return '';
                    if (editingGroup) {
                         const child = editingGroup.children?.find(c => c.id === iconPickerTarget.id);
                         if (child) return child.icon;
                    }
                    return navConfig.find(i => i.id === iconPickerTarget.id)?.icon || '';
                })()}
                onSelect={(icon) => {
                    if (iconPickerTarget) {
                        if (editingGroup && editingGroup.children?.some(c => c.id === iconPickerTarget.id)) {
                             handleGroupChildUpdate(iconPickerTarget.id, 'icon', icon);
                        } else {
                             handleUpdate(iconPickerTarget.id, 'icon', icon);
                        }
                    }
                }}
                onClose={() => setIconPickerTarget(null)}
            />
        </ScrollView>
    );
}

// Add types for AlertButton since it's used
interface AlertButton {
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}
