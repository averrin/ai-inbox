import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettingsStore, NavItemConfig, DEFAULT_NAV_ITEMS } from '../../store/settings';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Crypto from 'expo-crypto';
import { IconPicker } from '../ui/IconPicker';
import { UniversalIcon } from '../ui/UniversalIcon';
import { Colors } from '../ui/design-tokens';
import { showAlert } from '../../utils/alert';

export function NavigationSettings({ onBack }: { onBack?: () => void }) {
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
                                <View key={item.id} className="bg-surface-highlight/50 border border-border/40 rounded-xl p-3 mb-2">
                                    <View className="flex-row items-center gap-2.5 mb-2.5">
                                        <TouchableOpacity
                                            onPress={() => setIconPickerTarget({ id: item.id })}
                                            className="w-10 h-10 items-center justify-center bg-background rounded-lg border border-border"
                                        >
                                            <UniversalIcon
                                                name={item.icon}
                                                size={20}
                                                color="#818cf8"
                                            />
                                        </TouchableOpacity>
                                        
                                        <View className="flex-1">
                                            <TextInput
                                                value={item.title}
                                                onChangeText={(text) => handleGroupChildUpdate(item.id, 'title', text)}
                                                placeholder="Tab Title"
                                                placeholderTextColor={Colors.secondary}
                                                className="text-white text-base font-semibold p-0"
                                            />
                                            <Text className="text-text-tertiary text-[10px] font-mono leading-none">{item.id}</Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => handleRemoveFromGroup(item.id)}
                                            className="bg-error/10 w-8 h-8 items-center justify-center rounded-lg"
                                        >
                                            <Ionicons name="trash-outline" size={16} color={Colors.error} />
                                        </TouchableOpacity>
                                    </View>

                                    <View className="flex-row items-center justify-between pt-2 border-t border-border/10">
                                        <View className="flex-row items-center gap-1.5">
                                            <TouchableOpacity
                                                onPress={() => handleGroupChildMove(item.id, 'up')}
                                                disabled={index === 0}
                                                className={`w-7 h-7 items-center justify-center rounded ${index === 0 ? 'opacity-10' : 'bg-surface-highlight border border-border/20'}`}
                                            >
                                                <Ionicons name="chevron-up" size={14} color="white" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleGroupChildMove(item.id, 'down')}
                                                disabled={index === currentChildren.length - 1}
                                                className={`w-7 h-7 items-center justify-center rounded ${index === currentChildren.length - 1 ? 'opacity-10' : 'bg-surface-highlight border border-border/20'}`}
                                            >
                                                <Ionicons name="chevron-down" size={14} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                        
                                        <Text className="text-text-tertiary text-[9px] uppercase font-bold tracking-wider">Order</Text>
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
            <View key={item.id} className={`border rounded-xl p-3 mb-2.5 ${isGroup ? 'bg-primary/5 border-primary/20' : 'bg-surface border-border/30'}`}>
                {/* Main Row: Icon, Title, Actions */}
                <View className="flex-row items-center gap-2.5">
                    <TouchableOpacity
                        onPress={() => setIconPickerTarget({ id: item.id })}
                        className={`w-10 h-10 items-center justify-center rounded-lg border ${isGroup ? 'bg-primary/10 border-primary/20' : 'bg-surface-highlight border-border'}`}
                    >
                        <UniversalIcon
                            name={item.icon}
                            size={20}
                            color={isGroup ? "#818cf8" : "white"}
                        />
                    </TouchableOpacity>

                    <View className="flex-1">
                        <TextInput
                            value={item.title}
                            onChangeText={(text) => handleUpdate(item.id, 'title', text)}
                            placeholder="Label"
                            placeholderTextColor={Colors.secondary}
                            className="text-white text-base font-bold p-0"
                        />
                        <View className="flex-row items-center gap-1.5">
                            {isGroup && <Ionicons name="folder" size={10} color="#818cf8" />}
                            <Text className="text-text-tertiary text-[9px] font-mono uppercase tracking-tight leading-none">
                                {isGroup ? `Group (${item.children?.length || 0} items)` : item.id}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                        {isGroup && (
                            <TouchableOpacity
                                onPress={() => setEditingGroup(item)}
                                className="bg-primary/10 px-2.5 py-1.5 rounded-lg border border-primary/20"
                            >
                                <Text className="text-primary text-[10px] font-bold uppercase">Edit</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            className="bg-error/10 w-8 h-8 items-center justify-center rounded-lg"
                        >
                            <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Secondary Row: Reordering and Segment Switch */}
                <View className="flex-row items-center justify-between mt-2.5 pt-2.5 border-t border-border/5">
                    <View className="flex-row items-center gap-1.5">
                        <TouchableOpacity
                            onPress={() => handleMove(item.id, 'up')}
                            disabled={index === 0}
                            className={`w-8 h-8 items-center justify-center rounded ${index === 0 ? 'opacity-10' : 'bg-surface-highlight border border-border/20'}`}
                        >
                            <Ionicons name="chevron-up" size={16} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleMove(item.id, 'down')}
                            disabled={index === listLength - 1}
                            className={`w-8 h-8 items-center justify-center rounded ${index === listLength - 1 ? 'opacity-10' : 'bg-surface-highlight border border-border/20'}`}
                        >
                            <Ionicons name="chevron-down" size={16} color="white" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={() => handleSwitchSegment(item.id)}
                        className="flex-row items-center gap-1.5 bg-surface-highlight/30 px-2 py-1.5 rounded-lg border border-border/20"
                    >
                        <Ionicons name={isRight ? 'arrow-back' : 'arrow-forward'} size={12} color={Colors.secondary} />
                        <Text className="text-[10px] text-text-secondary font-bold uppercase">To {isRight ? 'Left' : 'Right'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <>
            <View className="mt-1 mb-8">
            <Card>
                <View className="mb-5">
                    <Text className="text-text-tertiary text-[10px] font-bold uppercase tracking-wider mb-2.5 ml-1">Left Segment</Text>
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
            </View>

            {renderGroupEditor()}

            <Modal visible={!!iconPickerTarget} animationType="slide" transparent>
                <View className="flex-1 bg-background pt-12 px-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">Select Icon</Text>
                        <TouchableOpacity onPress={() => setIconPickerTarget(null)} className="p-2 bg-surface rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    <IconPicker
                        value={(() => {
                            if (!iconPickerTarget) return '';
                            if (editingGroup) {
                                const child = editingGroup.children?.find(c => c.id === iconPickerTarget.id);
                                if (child) return child.icon;
                            }
                            return navConfig.find(i => i.id === iconPickerTarget.id)?.icon || '';
                        })()}
                        onChange={(icon: string) => {
                            if (iconPickerTarget) {
                                if (editingGroup && editingGroup.children?.some(c => c.id === iconPickerTarget.id)) {
                                    handleGroupChildUpdate(iconPickerTarget.id, 'icon', icon);
                                } else {
                                    handleUpdate(iconPickerTarget.id, 'icon', icon);
                                }
                                setIconPickerTarget(null);
                            }
                        }}
                    />
                    </View>
            </Modal>
        </>
    );
}

// Add types for AlertButton since it's used
interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}
