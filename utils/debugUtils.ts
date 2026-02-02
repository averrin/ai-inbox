import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { useMoodStore } from '../store/moodStore';
import { useHabitStore } from '../store/habitStore';
import { useGoogleStore } from '../store/googleStore';

// Masking helper for sensitive tokens
const maskToken = (token: string | null) => {
    if (!token) return null;
    if (token.length < 10) return '***';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
};

export async function generateDebugSnapshot() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // 1. Gather Metadata
        const meta = {
            timestamp,
            device: {
                os: Platform.OS,
                version: Platform.Version,
                model: Constants.deviceName, // or tailored device info
            },
            app: {
                version: Application.nativeApplicationVersion,
                buildVersion: Application.nativeBuildVersion,
                expoVersion: Constants.expoConfig?.version,
            }
        };

        // 2. Gather Store State
        const settings = useSettingsStore.getState();
        const eventTypes = useEventTypesStore.getState();
        const moods = useMoodStore.getState();
        const habits = useHabitStore.getState();
        const google = useGoogleStore.getState();

        const stores = {
            settings: {
                ...settings,
                // Remove functions from the dump usually handled by JSON.stringify but explicit is safe
            },
            eventTypes: {
                ...eventTypes,
            },
            moods: {
                ...moods,
            },
            habits: {
                ...habits,
            },
            google: {
                isConnected: google.isConnected,
                email: google.email,
                accessToken: maskToken(google.accessToken),
                refreshToken: maskToken(google.refreshToken),
            }
        };

        // 3. Dump AsyncStorage (Raw Persistence Layer)
        let storageDump: Record<string, string | null> = {};
        try {
            const keys = await AsyncStorage.getAllKeys();
            if (keys.length > 0) {
                const stores = await AsyncStorage.multiGet(keys);
                stores.forEach(([key, value]) => {
                    storageDump[key] = value;
                });
            }
        } catch (e) {
            console.error('Failed to dump AsyncStorage', e);
            storageDump = { error: 'Failed to read AsyncStorage' };
        }

        // 4. Construct Final Object
        const snapshot = {
            meta,
            stores,
            storage: storageDump,
        };

        // 5. Serialize and Write to File
        const fileName = `debug_snapshot_${timestamp}.json`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(snapshot, null, 2));

        // 6. Share
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
                mimeType: 'application/json',
                UTI: 'public.json',
                dialogTitle: 'Export Debug Snapshot'
            });
        } else {
            alert('Sharing is not available on this device');
        }

    } catch (e) {
        console.error('Failed to generate debug snapshot', e);
        alert('Failed to generate snapshot. Check logs.');
    }
}
