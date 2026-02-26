import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, RefreshControl } from 'react-native';
import { BaseScreen } from '../BaseScreen';
import { useProxmoxStore, ProxmoxServer, ProxmoxNode, ProxmoxService } from '../../../store/proxmoxStore';
import { fetchProxmoxData } from '../../../services/proxmoxService';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../ui/design-tokens';
import { useNavigation } from '@react-navigation/native';

const NodeItem = ({ node }: { node: ProxmoxNode }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: node.status === 'online' ? Colors.success : Colors.error, marginRight: 8 }} />
        <Text style={{ color: Colors.text.primary, fontWeight: '500', flex: 1 }}>{node.node}</Text>
        <Text style={{ color: Colors.text.tertiary, fontSize: 12 }}>{node.status}</Text>
    </View>
);

const ServiceItem = ({ service }: { service: ProxmoxService }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: service.status === 'running' ? Colors.success : Colors.text.tertiary, marginRight: 8 }} />
        <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: Colors.text.primary, fontWeight: '500', marginRight: 6 }}>{service.name}</Text>
                <Text style={{ color: Colors.text.tertiary, fontSize: 10 }}>{service.vmid}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: Colors.text.tertiary, fontSize: 10, marginRight: 6 }}>{service.type.toUpperCase()}</Text>
                {service.ip && <Text style={{ color: Colors.text.secondary, fontSize: 10 }}>{service.ip}</Text>}
            </View>
        </View>
        <Text style={{ color: Colors.text.tertiary, fontSize: 12 }}>{service.status}</Text>
    </View>
);

const ServerItem = ({ server }: { server: ProxmoxServer }) => {
    const [expanded, setExpanded] = useState(true);

    return (
        <View style={{ backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.text.primary }}>{server.name}</Text>
                        {server.lastSync && (
                            <View style={{ backgroundColor: Colors.surfaceHighlight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, color: Colors.text.tertiary }}>
                                    Synced {new Date(server.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={{ color: Colors.text.secondary, fontSize: 12 }}>{server.url}</Text>
                    {server.lastError && (
                        <Text style={{ color: Colors.error, fontSize: 11, marginTop: 4 }}>
                            Error: {server.lastError}
                        </Text>
                    )}
                </View>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>

            {expanded && (
                <View style={{ paddingBottom: 16 }}>
                    <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surfaceHighlightSubtle }}>
                        <Text style={{ color: Colors.text.secondary, fontWeight: 'bold', fontSize: 12 }}>NODES ({server.nodes.length})</Text>
                    </View>
                    {server.nodes.length > 0 ? (
                        server.nodes.map(node => <NodeItem key={node.id} node={node} />)
                    ) : (
                        <Text style={{ padding: 16, color: Colors.text.tertiary, fontStyle: 'italic' }}>No nodes found.</Text>
                    )}

                    <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surfaceHighlightSubtle, marginTop: 8 }}>
                        <Text style={{ color: Colors.text.secondary, fontWeight: 'bold', fontSize: 12 }}>SERVICES ({server.services.length})</Text>
                    </View>
                    {server.services.length > 0 ? (
                        server.services.map(service => <ServiceItem key={service.id} service={service} />)
                    ) : (
                        <Text style={{ padding: 16, color: Colors.text.tertiary, fontStyle: 'italic' }}>No services found.</Text>
                    )}
                </View>
            )}
        </View>
    );
};

export default function ProxmoxScreen() {
    const { servers, setServerData, setServerError } = useProxmoxStore();
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    const onRefresh = async () => {
        if (servers.length === 0) return;
        setRefreshing(true);

        let errors: string[] = [];

        for (const server of servers) {
            try {
                const data = await fetchProxmoxData(server);
                setServerData(server.id, data.nodes, data.services, data.error);
                if (data.error) errors.push(`${server.name}: ${data.error}`);
            } catch (e: any) {
                console.error(`Failed to refresh server ${server.name}`, e);
                const msg = e.message || 'Unknown error';
                setServerError(server.id, msg);
                errors.push(`${server.name}: ${msg}`);
            }
        }

        if (errors.length > 0) {
            // Optional: Alert the user, but maybe the UI text is enough
             Alert.alert("Sync Issues", errors.join('\n'));
        }

        setRefreshing(false);
    };

    return (
        <BaseScreen
            title="Proxmox"
            rightActions={[
                {
                    icon: 'refresh',
                    onPress: onRefresh
                },
                {
                    icon: 'settings-outline',
                    // @ts-ignore
                    onPress: () => navigation.navigate('ProxmoxSettings')
                }
            ]}
        >
            {({ insets, headerHeight }) => (
                <View style={{ flex: 1, paddingTop: headerHeight, paddingHorizontal: 16 }}>
                    {servers.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ color: Colors.text.secondary }}>No servers configured.</Text>
                            <TouchableOpacity onPress={() =>
                                // @ts-ignore
                                navigation.navigate('ProxmoxSettings')
                            }>
                                <Text style={{ color: Colors.primary, marginTop: 8 }}>Go to Settings to Add Server</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                            }
                        >
                            {servers.map(server => (
                                <ServerItem key={server.id} server={server} />
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}
        </BaseScreen>
    );
}
