import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readVaultStructure, checkDirectoryExists } from '../utils/saf';

interface CachedFile {
    mtime: number;
    display: string;
    frontmatterKeys?: string[];
    frontmatter?: Record<string, any>;
}

interface VaultState {
    structure: string;
    metadataCache: Record<string, CachedFile>; // path -> { mtime, display, frontmatterKeys }
    lastUpdated: number;
    isUpdating: boolean;
    refreshStructure: (vaultUri: string, contextRoot?: string) => Promise<void>;
    getStructure: (vaultUri: string, contextRoot?: string) => Promise<string>;
}

// refresh interval in milliseconds (e.g. 5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

export const useVaultStore = create<VaultState>()(
    persist(
        (set, get) => ({
            structure: '',
            metadataCache: {},
            lastUpdated: 0,
            isUpdating: false,

            refreshStructure: async (vaultUri: string, contextRoot?: string) => {
                if (get().isUpdating) return;
                set({ isUpdating: true });

                try {
                    let targetUri = vaultUri;
                    let rootPrefix = '';

                    if (contextRoot && contextRoot.trim()) {
                        const contextUri = await checkDirectoryExists(vaultUri, contextRoot.trim());
                        if (contextUri) {
                            targetUri = contextUri;
                            rootPrefix = contextRoot.trim();
                        }
                    }

                    console.log('[VaultService] Refreshing structure with metadata cache...');

                    // Pass existing cache to readVaultStructure to optimize reads
                    const { structure, updatedCache } = await readVaultStructure(
                        targetUri,
                        2,
                        get().metadataCache
                    );

                    console.log('[VaultService] Structure refreshed.');

                    set({
                        structure,
                        metadataCache: updatedCache,
                        lastUpdated: Date.now(),
                        isUpdating: false
                    });
                } catch (e) {
                    console.error('[VaultService] Failed to refresh structure', e);
                    set({ isUpdating: false });
                }
            },

            getStructure: async (vaultUri: string, contextRoot?: string) => {
                const { structure, lastUpdated, refreshStructure, isUpdating } = get();
                const now = Date.now();

                const shouldRefresh = !structure || (now - lastUpdated > CACHE_TTL);

                if (shouldRefresh && !isUpdating) {
                    // Trigger background refresh
                    refreshStructure(vaultUri, contextRoot);
                }

                return structure;
            }
        }),
        {
            name: 'vault-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                structure: state.structure,
                metadataCache: state.metadataCache,
                lastUpdated: state.lastUpdated
            }), // Persist all relevant fields
        }
    )
);
