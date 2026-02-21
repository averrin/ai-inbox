import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore, Contact } from '../../store/settings';
import { useGoogleStore } from '../../store/googleStore';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SettingsListItem } from '../ui/SettingsListItem';
import { ColorPicker } from '../ui/ColorPicker';
import { IconPicker } from '../ui/IconPicker';
import { UniversalIcon } from '../ui/UniversalIcon';
import { MetadataChip } from '../ui/MetadataChip';
import { Colors, Palette } from '../ui/design-tokens';

export function ContactsSettings() {
    const { contacts, addContact, updateContact, deleteContact } = useSettingsStore();

    // Contact Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [cName, setCName] = useState('');
    const [cEmail, setCEmail] = useState('');
    const [cColor, setCColor] = useState('#818cf8');
    const [cIcon, setCIcon] = useState('person');
    const [cIsWife, setCIsWife] = useState(false);

    const openContactModal = (contact?: Contact) => {
        if (contact) {
            setEditingId(contact.id);
            setCName(contact.name);
            setCEmail(contact.email);
            setCColor(contact.color || '#818cf8');
            setCIcon(contact.icon || 'person');
            setCIsWife(contact.isWife || false);
        } else {
            setEditingId(null);
            setCName('');
            setCEmail('');
            setCColor('#818cf8');
            setCIcon('person');
            setCIsWife(false);
        }
        setModalVisible(true);
    };

    const saveContact = () => {
        if (!cName.trim() || !cEmail.trim()) {
            Alert.alert('Missing Info', 'Name and Email are required.');
            return;
        }

        if (editingId) {
            updateContact({
                id: editingId,
                name: cName.trim(),
                email: cEmail.trim(),
                color: cColor,
                icon: cIcon,
                isWife: cIsWife
            });
        } else {
            addContact({
                name: cName.trim(),
                email: cEmail.trim(),
                color: cColor,
                icon: cIcon,
                isWife: cIsWife
            });
        }
        setModalVisible(false);
    };

    const handleDeleteContact = () => {
        if (editingId) {
            Alert.alert(
                "Delete Contact",
                "Are you sure?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete", style: "destructive", onPress: () => {
                            deleteContact(editingId);
                            setModalVisible(false);
                        }
                    }
                ]
            );
        }
    };

    return (
        <View className="flex-1">

            <Card>
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-text-secondary font-semibold">Contacts</Text>
                    <TouchableOpacity
                        onPress={() => openContactModal()}
                        className="bg-primary px-3 py-1.5 rounded-full flex-row items-center"
                    >
                        <Ionicons name="add" size={16} color="white" />
                        <Text className="text-white text-xs font-bold ml-1">Add</Text>
                    </TouchableOpacity>
                </View>

                {contacts.length === 0 ? (
                    <Text className="text-secondary text-center py-4 italic">No contacts added yet.</Text>
                ) : (
                    contacts.map(contact => (
                        <SettingsListItem
                            key={contact.id}
                            onPress={() => openContactModal(contact)}
                            color={contact.color}
                        >
                            <View className="flex-row items-center flex-1">
                                <View className="w-10 h-10 rounded-full bg-surface-highlight items-center justify-center mr-3">
                                    <UniversalIcon name={contact.icon || 'person'} size={20} color={contact.color || Colors.text.tertiary} />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="text-white font-semibold">{contact.name}</Text>
                                        {contact.isWife && (
                                            <MetadataChip
                                                icon="heart"
                                                label="WIFE"
                                                color={Palette[2]}
                                                variant="solid"
                                                size="sm"
                                                rounding="sm"
                                            />
                                        )}
                                    </View>
                                    <Text className="text-text-tertiary text-xs" numberOfLines={1}>{contact.email}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#475569" />
                            </View>
                        </SettingsListItem>
                    ))
                )}
            </Card>

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-background rounded-t-3xl p-6 h-[85%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-xl font-bold">
                                {editingId ? 'Edit Contact' : 'New Contact'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close" size={24} color="white" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                            <Input
                                label="Name"
                                value={cName}
                                onChangeText={setCName}
                                placeholder="Contact Name"
                            />

                            <Input
                                label="Email Address"
                                value={cEmail}
                                onChangeText={setCEmail}
                                placeholder="email@example.com"
                                autoCapitalize="none"
                            />

                            <View className="mb-6">
                                <Text className="text-text-secondary mb-2 text-sm font-semibold ml-1">Color</Text>
                                <ColorPicker
                                    value={cColor}
                                    onChange={setCColor}
                                />
                            </View>

                            <View className="mb-6">
                                <Text className="text-text-secondary mb-2 text-sm font-semibold ml-1">Icon</Text>
                                <IconPicker
                                    value={cIcon}
                                    onChange={setCIcon}
                                />
                            </View>

                            <TouchableOpacity
                                onPress={() => setCIsWife(!cIsWife)}
                                className={`flex-row items-center justify-between p-4 rounded-xl border mb-6 ${cIsWife ? 'bg-pink-500 border-pink-500' : 'bg-surface border-border'}`}
                            >
                                <View className="flex-row items-center gap-3">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${cIsWife ? 'bg-pink-500' : 'bg-surface-highlight'}`}>
                                        <Ionicons name="heart" size={16} color="white" />
                                    </View>
                                    <View>
                                        <Text className={`font-bold ${cIsWife ? 'text-pink-400' : 'text-text-secondary'}`}>Spouse / Partner</Text>
                                        <Text className="text-secondary text-xs">Used for "Personal" event logic</Text>
                                    </View>
                                </View>
                                <View className={`w-6 h-6 rounded-full border items-center justify-center ${cIsWife ? 'bg-pink-500 border-pink-500' : 'border-secondary'}`}>
                                    {cIsWife && <Ionicons name="checkmark" size={14} color="white" />}
                                </View>
                            </TouchableOpacity>

                            <Button
                                title="Save Contact"
                                onPress={saveContact}
                            />

                            {editingId && (
                                <View className="mt-4">
                                    <Button
                                        title="Delete Contact"
                                        onPress={handleDeleteContact}
                                        variant="danger"
                                    />
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
