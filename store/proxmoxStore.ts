import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface ProxmoxNode {
    id: string; // 'node/pve'
    node: string; // 'pve'
    status: 'online' | 'offline' | 'unknown';
    cpu?: number;
    maxcpu?: number;
    mem?: number;
    maxmem?: number;
    uptime?: number;
    ssl_fingerprint?: string;
}

export interface ProxmoxService {
    id: string; // 'lxc/100' or 'qemu/101'
    vmid: number;
    name: string;
    status: 'running' | 'stopped' | 'unknown';
    type: 'lxc' | 'qemu';
    node: string; // Which node it belongs to
    uptime?: number;
    cpus?: number;
    maxmem?: number;
    disk?: number;
    maxdisk?: number;
    netif?: any; // Network interface info if available
    ip?: string; // Extracted IP if available
}

export interface ProxmoxServer {
    id: string;
    name: string;
    url: string; // Base URL e.g. https://192.168.1.100:8006
    username: string; // e.g. root@pam
    tokenId: string; // e.g. mytoken
    secret: string; // e.g. xxxxx-xxxx-xxxx
    nodes: ProxmoxNode[];
    services: ProxmoxService[];
    lastSync?: number;
    lastError?: string; // Store last error for debugging
}

interface ProxmoxState {
    servers: ProxmoxServer[];
    addServer: (server: Omit<ProxmoxServer, 'id' | 'nodes' | 'services'>) => void;
    removeServer: (id: string) => void;
    updateServer: (id: string, updates: Partial<ProxmoxServer>) => void;
    setServerData: (serverId: string, nodes: ProxmoxNode[], services: ProxmoxService[], error?: string) => void;
    setServerError: (serverId: string, error: string) => void;
}

export const useProxmoxStore = create<ProxmoxState>()(
    persist(
        (set) => ({
            servers: [],
            addServer: (server) => set((state) => ({
                servers: [
                    ...state.servers,
                    {
                        ...server,
                        id: Crypto.randomUUID(),
                        nodes: [],
                        services: [],
                    }
                ]
            })),
            removeServer: (id) => set((state) => ({
                servers: state.servers.filter((s) => s.id !== id)
            })),
            updateServer: (id, updates) => set((state) => ({
                servers: state.servers.map((s) => s.id === id ? { ...s, ...updates } : s)
            })),
            setServerData: (serverId, nodes, services, error) => set((state) => ({
                servers: state.servers.map((s) =>
                    s.id === serverId
                        ? { ...s, nodes, services, lastSync: Date.now(), lastError: error }
                        : s
                )
            })),
            setServerError: (serverId, error) => set((state) => ({
                servers: state.servers.map((s) =>
                    s.id === serverId
                        ? { ...s, lastError: error }
                        : s
                )
            })),
        }),
        {
            name: 'proxmox-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
