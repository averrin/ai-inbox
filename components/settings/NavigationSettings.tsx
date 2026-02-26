import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Modal, Pressable } from 'react-native';
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
import DraggableFlatList, { ScaleDecorator, RenderItemParams, ShadowDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

        const handleGroupChildDragEnd = ({ data }: { data: NavItemConfig[] }) => {
            const newGroup = { ...editingGroup, children: data };
            setEditingGroup(newGroup);

            const newNavConfig = navConfig.map(i => i.id === newGroup.id ? newGroup : i);
            setNavConfig(newNavConfig);
        };

        const renderGroupChild = ({ item, drag, isActive }: RenderItemParams<NavItemConfig>) => {
            return (
                <ScaleDecorator>
                    <TouchableOpacity
                        onLongPress={drag}
                        disabled={isActive}
                        key={item.id}
                        className={`flex-row items-center bg-surface-highlight/50 border border-border/40 rounded-xl p-2 mb-2 gap-3 ${isActive ? 'opacity-70' : ''}`}
                    >
                        <View className="flex-col gap-1 items-center justify-center h-full px-1">
                            <Ionicons name="menu-outline" size={20} color="white" className="opacity-50" />
                        </View>

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
                                className="text-white text-sm font-bold p-0 leading-tight"
                            />
                            <Text className="text-text-tertiary text-[9px] font-mono leading-none mt-0.5">{item.id}</Text>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleRemoveFromGroup(item.id)}
                            className="bg-error/10 w-8 h-8 items-center justify-center rounded-lg"
                        >
                            <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </ScaleDecorator>
            );
        }

        return (
            <Modal visible={!!editingGroup} animationType="slide" transparent>
                <GestureHandlerRootView className="flex-1 bg-background pt-12 px-4">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">Edit Group: {editingGroup.title}</Text>
                        <TouchableOpacity onPress={() => setEditingGroup(null)} className="p-2 bg-surface rounded-full">
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-1">
                        <Text className="text-text-secondary mb-2 font-semibold uppercase text-xs">Items in Group</Text>

                        <View className="flex-1 max-h-[50%] mb-4">
                            {currentChildren.length === 0 ? (
                                <Text className="text-text-tertiary italic mb-4">No items in this group.</Text>
                            ) : (
                                <DraggableFlatList
                                    data={currentChildren}
                                    onDragEnd={handleGroupChildDragEnd}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderGroupChild}
                                    containerStyle={{ flex: 1 }}
                                />
                            )}
                        </View>

                        <ScrollView className="flex-1">
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
                </GestureHandlerRootView>
            </Modal>
        );
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<NavItemConfig>) => {
        const isGroup = item.type === 'group';
        const isRight = item.segment === 'right';

        return (
            <ScaleDecorator>
                <TouchableOpacity
                    onLongPress={drag}
                    disabled={isActive}
                    key={item.id}
                    className={`flex-row items-center border rounded-xl p-2 mb-2 gap-3 ${isGroup ? 'bg-primary/5 border-primary/20' : 'bg-surface border-border/30'} ${isActive ? 'opacity-70' : ''}`}
                >
                    {/* Drag Handle */}
                    <View className="flex-col gap-1 items-center justify-center h-full px-1">
                         <Ionicons name="menu-outline" size={24} color={Colors.secondary} className="opacity-50" />
                    </View>

                    {/* Icon */}
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

                    {/* Content */}
                    <View className="flex-1">
                        <TextInput
                            value={item.title}
                            onChangeText={(text) => handleUpdate(item.id, 'title', text)}
                            placeholder="Label"
                            placeholderTextColor={Colors.secondary}
                            className="text-white text-sm font-bold p-0 leading-tight"
                        />
                        <View className="flex-row items-center gap-1.5 mt-0.5">
                            {isGroup && <Ionicons name="folder" size={10} color="#818cf8" />}
                            <Text className="text-text-tertiary text-[9px] font-mono uppercase tracking-tight leading-none" numberOfLines={1}>
                                {isGroup ? `Group (${item.children?.length || 0})` : item.id}
                            </Text>
                        </View>
                    </View>

                    {/* Actions */}
                    <View className="flex-row items-center gap-1">
                        {isGroup && (
                            <TouchableOpacity
                                onPress={() => setEditingGroup(item)}
                                className="w-8 h-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"
                            >
                                <Ionicons name="create-outline" size={16} color="#818cf8" />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => handleSwitchSegment(item.id)}
                            className="w-8 h-8 items-center justify-center rounded-lg bg-surface-highlight/30 border border-border/20"
                        >
                            <Ionicons name={isRight ? 'arrow-back' : 'arrow-forward'} size={16} color={Colors.secondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleDelete(item.id)}
                            className="w-8 h-8 items-center justify-center rounded-lg bg-error/10"
                        >
                            <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </ScaleDecorator>
        );
    };

    return (
        <GestureHandlerRootView className="flex-1">
            <View className="mt-1 mb-8">
            <Card>
                <View className="mb-5">
                    <Text className="text-text-tertiary text-[10px] font-bold uppercase tracking-wider mb-2.5 ml-1">Left Segment</Text>
                    <View style={{ minHeight: 10 }}>
                        <DraggableFlatList
                            data={leftItems}
                            onDragEnd={({ data }) => updateConfig(data, rightItems)}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            scrollEnabled={false}
                        />
                    </View>

                    <Button
                        title="+ Add Group (Left)"
                        onPress={() => handleAddGroup('left')}
                        variant="primary"
                        className="mt-2"
                    />
                </View>

                <View className="mb-4 pt-4 border-t border-border">
                    <Text className="text-text-secondary mb-2 font-semibold">Right Segment</Text>
                    <View style={{ minHeight: 10 }}>
                         <DraggableFlatList
                            data={rightItems}
                            onDragEnd={({ data }) => updateConfig(leftItems, data)}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                            scrollEnabled={false}
                        />
                    </View>

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
        </GestureHandlerRootView>
    );
}

// Add types for AlertButton since it's used
interface AlertButton {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
}
