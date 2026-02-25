import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { BaseScreen } from '../BaseScreen';
import { useProxmoxStore, ProxmoxServer } from '../../../store/proxmoxStore';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../ui/design-tokens';

export default function ProxmoxSettingsScreen() {
    const { servers, addServer, updateServer, removeServer } = useProxmoxStore();
    const [showModal, setShowModal] = useState(false);
    const [editingServer, setEditingServer] = useState<ProxmoxServer | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [username, setUsername] = useState('root@pam');
    const [tokenId, setTokenId] = useState('');
    const [secret, setSecret] = useState('');

    const resetForm = () => {
        setName('');
        setUrl('');
        setUsername('root@pam');
        setTokenId('');
        setSecret('');
        setEditingServer(null);
    };

    const handleEdit = (server: ProxmoxServer) => {
        setEditingServer(server);
        setName(server.name);
        setUrl(server.url);
        setUsername(server.username);
        setTokenId(server.tokenId);
        setSecret(server.secret);
        setShowModal(true);
    };

    const handleDelete = (server: ProxmoxServer) => {
        Alert.alert(
            "Delete Server",
            `Are you sure you want to delete "${server.name}"?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => removeServer(server.id) }
            ]
        );
    };

    const handleSave = () => {
        if (!name || !url || !username || !tokenId || !secret) {
            alert('Please fill all fields');
            return;
        }

        let cleanUrl = url.trim();
        if (!cleanUrl.startsWith('http')) {
            cleanUrl = 'https://' + cleanUrl;
        }
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }

        if (editingServer) {
            updateServer(editingServer.id, {
                name,
                url: cleanUrl,
                username,
                tokenId,
                secret
            });
        } else {
            addServer({
                name,
                url: cleanUrl,
                username,
                tokenId,
                secret
            });
        }

        setShowModal(false);
        resetForm();
    };

    const renderServer = ({ item }: { item: ProxmoxServer }) => (
        <View style={{ padding: 16, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.text.primary }}>{item.name}</Text>
                <Text style={{ color: Colors.text.secondary }}>{item.url}</Text>
                <Text style={{ color: Colors.text.tertiary, fontSize: 12 }}>{item.username}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => handleEdit(item)}>
                    <Ionicons name="pencil" size={24} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Ionicons name="trash" size={24} color={Colors.error} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <BaseScreen
            title="Manage Servers"
            rightActions={[
                {
                    icon: 'add',
                    onPress: () => {
                        resetForm();
                        setShowModal(true);
                    }
                }
            ]}
        >
            {({ insets, headerHeight }) => (
                <View style={{ flex: 1, paddingTop: headerHeight, paddingHorizontal: 16 }}>
                    {servers.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: Colors.text.secondary }}>No servers configured.</Text>
                            <TouchableOpacity onPress={() => setShowModal(true)}>
                                <Text style={{ color: Colors.primary, marginTop: 8 }}>Add a Proxmox Server</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <FlatList
                            data={servers}
                            renderItem={renderServer}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                        />
                    )}

                    <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: Colors.surface }}>
                            <ScrollView contentContainerStyle={{ padding: 24 }}>
                                <Text style={{ fontSize: 24, fontWeight: 'bold', color: Colors.text.primary, marginBottom: 24 }}>
                                    {editingServer ? 'Edit Server' : 'Add Server'}
                                </Text>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: Colors.text.secondary, marginBottom: 8 }}>Server Name</Text>
                                    <TextInput
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="My Home Lab"
                                        placeholderTextColor={Colors.text.tertiary}
                                        style={{ backgroundColor: Colors.background, color: Colors.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                                    />
                                </View>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: Colors.text.secondary, marginBottom: 8 }}>URL (Base)</Text>
                                    <TextInput
                                        value={url}
                                        onChangeText={setUrl}
                                        placeholder="https://192.168.1.100:8006"
                                        autoCapitalize="none"
                                        keyboardType="url"
                                        placeholderTextColor={Colors.text.tertiary}
                                        style={{ backgroundColor: Colors.background, color: Colors.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                                    />
                                </View>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: Colors.text.secondary, marginBottom: 8 }}>Username (User@Realm)</Text>
                                    <TextInput
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="root@pam"
                                        autoCapitalize="none"
                                        placeholderTextColor={Colors.text.tertiary}
                                        style={{ backgroundColor: Colors.background, color: Colors.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                                    />
                                </View>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: Colors.text.secondary, marginBottom: 8 }}>Token ID</Text>
                                    <TextInput
                                        value={tokenId}
                                        onChangeText={setTokenId}
                                        placeholder="monitoring"
                                        autoCapitalize="none"
                                        placeholderTextColor={Colors.text.tertiary}
                                        style={{ backgroundColor: Colors.background, color: Colors.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                                    />
                                </View>

                                <View style={{ marginBottom: 24 }}>
                                    <Text style={{ color: Colors.text.secondary, marginBottom: 8 }}>Secret (UUID)</Text>
                                    <TextInput
                                        value={secret}
                                        onChangeText={setSecret}
                                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                        secureTextEntry={!editingServer} // Allow viewing secret only when adding initially? Or show asterisks. Standard is usually hidden.
                                        placeholderTextColor={Colors.text.tertiary}
                                        style={{ backgroundColor: Colors.background, color: Colors.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border }}
                                    />
                                </View>

                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity onPress={() => setShowModal(false)} style={{ flex: 1, padding: 16, alignItems: 'center', borderRadius: 8, backgroundColor: Colors.surfaceHighlight }}>
                                        <Text style={{ color: Colors.text.primary, fontWeight: 'bold' }}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={handleSave} style={{ flex: 1, padding: 16, alignItems: 'center', borderRadius: 8, backgroundColor: Colors.primary }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </Modal>
                </View>
            )}
        </BaseScreen>
    );
}
