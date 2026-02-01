import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventTypesStore } from '../store/eventTypes';
import { EventType } from '../services/eventTypeService';
import { ActionButton } from './ui/ActionButton';
import { SettingsListItem } from './ui/SettingsListItem';
import { ColorPicker, PRESET_COLORS } from './ui/ColorPicker';
import * as Crypto from 'expo-crypto';

export function EventTypesSettings() {
    const { eventTypes, addType, updateType, deleteType } = useEventTypesStore();
    const [editingType, setEditingType] = useState<EventType | null>(null);
    const [title, setTitle] = useState('');
    const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
    const [hideBadges, setHideBadges] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);

    const handleEdit = (type: EventType) => {
        setEditingType(type);
        setTitle(type.title);
        setSelectedColor(type.color);
        setHideBadges(type.hideBadges || false);
        setIsFormVisible(true);
    };

    const handleCreate = () => {
        setEditingType(null);
        setTitle('');
        setSelectedColor(PRESET_COLORS[0]);
        setHideBadges(false);
        setIsFormVisible(true);
    };

    const handleSave = async () => {
        if (!title.trim()) return;

        try {
            if (editingType) {
                await updateType({ ...editingType, title, color: selectedColor, hideBadges });
            } else {
                await addType({
                    id: Crypto.randomUUID(),
                    title,
                    color: selectedColor,
                    hideBadges
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
        <SettingsListItem color={item.color}>
            <View className="flex-1">
                <Text className="text-white text-base font-medium">{item.title}</Text>
            </View>

            <View className="flex-row gap-2 items-center">
                <TouchableOpacity onPress={() => handleEdit(item)} className="p-2">
                    <Ionicons name="pencil" size={20} color="#94a3b8" />
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
                    <Text className="text-slate-500 text-center mt-10">
                        No event types defined yet.
                    </Text>
                }
            />

            <View className="mt-4">
                <TouchableOpacity
                    onPress={handleCreate}
                    className="bg-indigo-600 p-4 rounded-lg flex-row justify-center items-center gap-2"
                >
                    <Ionicons name="add" size={24} color="white" />
                    <Text className="text-white font-semibold">Create New Type</Text>
                </TouchableOpacity>
            </View>

            {/* Edit/Create Form Modal */}
            <Modal visible={isFormVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 justify-center p-4">
                    <View className="bg-slate-900 rounded-xl p-6">
                        <Text className="text-white text-lg font-bold mb-4">
                            {editingType ? 'Edit Type' : 'New Type'}
                        </Text>

                        <Text className="text-slate-400 mb-2 text-sm">Title</Text>
                        <TextInput
                            className="bg-slate-800 text-white p-3 rounded-lg mb-6"
                            placeholder="e.g. Work, Gym"
                            placeholderTextColor="#64748b"
                            value={title}
                            onChangeText={setTitle}
                            autoFocus
                        />

                        <ColorPicker
                            value={selectedColor}
                            onChange={setSelectedColor}
                            label="Color"
                            style={{ marginBottom: 24 }}
                        />

                        <View className="bg-slate-800 rounded-lg p-3 flex-row justify-between items-center mb-8">
                            <View className="flex-1 mr-3">
                                <Text className="text-white font-medium">Hide Badges</Text>
                                <Text className="text-slate-500 text-xs">Hide corner badges for events of this type</Text>
                            </View>
                            <Switch
                                value={hideBadges}
                                onValueChange={setHideBadges}
                                trackColor={{ false: "#334155", true: "#4f46e5" }}
                                thumbColor={hideBadges ? "#ffffff" : "#94a3b8"}
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 bg-slate-800 p-3 rounded-lg items-center"
                                onPress={() => setIsFormVisible(false)}
                            >
                                <Text className="text-slate-300 font-semibold">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 bg-indigo-600 p-3 rounded-lg items-center"
                                onPress={handleSave}
                            >
                                <Text className="text-white font-semibold">Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
