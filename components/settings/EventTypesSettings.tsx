import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventTypesStore } from '../../store/eventTypes';
import { EventType } from '../../services/eventTypeService';
import { ActionButton } from '../ui/ActionButton';
import { SettingsListItem } from '../ui/SettingsListItem';
import { ColorPicker } from '../ui/ColorPicker';
import { Palette, Colors } from '../ui/design-tokens';
import { IconPicker } from '../ui/IconPicker';
import { EventTypeBadge } from '../ui/EventTypeBadge';
import * as Crypto from 'expo-crypto';

export function EventTypesSettings() {
    const { eventTypes, addType, updateType, deleteType } = useEventTypesStore();
    const [editingType, setEditingType] = useState<EventType | null>(null);
    const [title, setTitle] = useState('');
    const [selectedColor, setSelectedColor] = useState(Palette[0]);
    const [hideBadges, setHideBadges] = useState(false);
    const [isInverted, setIsInverted] = useState(false);
    const [icon, setIcon] = useState<string>('');
    const [isFormVisible, setIsFormVisible] = useState(false);

    const handleEdit = (type: EventType) => {
        setEditingType(type);
        setTitle(type.title);
        setSelectedColor(type.color);
        setHideBadges(type.hideBadges || false);
        setIsInverted(type.isInverted || false);
        setIcon(type.icon || '');
        setIsFormVisible(true);
    };

    const handleCreate = () => {
        setEditingType(null);
        setTitle('');
        setSelectedColor(Palette[0]);
        setHideBadges(false);
        setIsInverted(false);
        setIcon('');
        setIsFormVisible(true);
    };

    const handleSave = async () => {
        if (!title.trim()) return;

        try {
            if (editingType) {
                await updateType({ ...editingType, title, color: selectedColor, hideBadges, isInverted, icon });
            } else {
                await addType({
                    id: Crypto.randomUUID(),
                    title,
                    color: selectedColor,
                    hideBadges,
                    isInverted,
                    icon
                });
            }
        } catch (error) {
            console.error('Error saving event type:', error);
        } finally {
            setIsFormVisible(false);
        }
    };

    const handleDelete = async (id: string) => {
        await deleteType(id);
    };

    const renderItem = ({ item }: { item: EventType }) => (
        <SettingsListItem>
            <View className="flex-1 pr-2">
                <EventTypeBadge type={item} />
            </View>

            <View className="flex-row gap-2 items-center">
                <TouchableOpacity onPress={() => handleEdit(item)} className="p-2">
                    <Ionicons name="pencil" size={20} color={Colors.text.tertiary} />
                </TouchableOpacity>
                <ActionButton
                    onPress={() => handleDelete(item.id)}
                    icon="trash-outline"
                    variant="danger"
                />
            </View>
        </SettingsListItem>
    );

    return (
        <View className="flex-1">
            <FlatList
                data={eventTypes}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                    <Text className="text-secondary text-center mt-10">
                        No event types defined yet.
                    </Text>
                }
            />

            <View className="mt-4">
                <TouchableOpacity
                    onPress={handleCreate}
                    className="bg-primary p-4 rounded-lg flex-row justify-center items-center gap-2"
                >
                    <Ionicons name="add" size={24} color="white" />
                    <Text className="text-white font-semibold">Create New Type</Text>
                </TouchableOpacity>
            </View>

            {/* Edit/Create Form Modal */}
            <Modal visible={isFormVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 justify-center p-4">
                    <View className="bg-background rounded-xl p-6 max-h-[90%]">
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text className="text-white text-lg font-bold mb-4">
                                {editingType ? 'Edit Type' : 'New Type'}
                            </Text>

                            <Text className="text-text-tertiary mb-2 text-sm">Title</Text>
                            <TextInput
                                className="bg-surface text-white p-3 rounded-lg mb-6"
                                placeholder="e.g. Work, Gym"
                                placeholderTextColor={Colors.secondary}
                                value={title}
                                onChangeText={setTitle}
                                autoFocus={!editingType}
                            />

                            <ColorPicker
                                value={selectedColor}
                                onChange={setSelectedColor}
                                label="Color"
                                style={{ marginBottom: 24 }}
                            />

                            <View className="bg-surface rounded-lg p-3 flex-row justify-between items-center mb-4">
                                <View className="flex-1 mr-3">
                                    <Text className="text-white font-medium">Inverted Mode</Text>
                                    <Text className="text-secondary text-xs">Dark background with colored text/border</Text>
                                </View>
                                <Switch
                                    value={isInverted}
                                    onValueChange={setIsInverted}
                                    trackColor={{ false: Colors.surfaceHighlight, true: "#4f46e5" }}
                                    thumbColor={isInverted ? Colors.white : Colors.text.tertiary}
                                />
                            </View>

                            <View className="bg-surface rounded-lg p-3 flex-row justify-between items-center mb-4">
                                <View className="flex-1 mr-3">
                                    <Text className="text-white font-medium">Hide Badges</Text>
                                    <Text className="text-secondary text-xs">Hide corner badges for events of this type</Text>
                                </View>
                                <Switch
                                    value={hideBadges}
                                    onValueChange={setHideBadges}
                                    trackColor={{ false: Colors.surfaceHighlight, true: "#4f46e5" }}
                                    thumbColor={hideBadges ? Colors.white : Colors.text.tertiary}
                                />
                            </View>

                            <View className="mb-6 h-64">
                                <IconPicker
                                    value={icon}
                                    onChange={setIcon}
                                    label="Icon (Optional)"
                                />
                            </View>

                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    className="flex-1 bg-surface p-3 rounded-lg items-center"
                                    onPress={() => setIsFormVisible(false)}
                                >
                                    <Text className="text-text-secondary font-semibold">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 bg-primary p-3 rounded-lg items-center"
                                    onPress={handleSave}
                                >
                                    <Text className="text-white font-semibold">Save</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
