import { StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const createSecureStorage = (sensitiveKeys: string[]): StateStorage => {
  return {
    getItem: async (name: string): Promise<string | null> => {
      // 1. Get the base state from AsyncStorage
      const json = await AsyncStorage.getItem(name);
      if (!json) return null;

      try {
        const state = JSON.parse(json);

        // 2. Rehydrate sensitive keys from SecureStore
        if (Platform.OS !== 'web') {
           for (const key of sensitiveKeys) {
             try {
                const secureValue = await SecureStore.getItemAsync(`${name}-${key}`);
                if (secureValue !== null && state.state) {
                  state.state[key] = secureValue;
                }
             } catch (e) {
                console.warn(`[SecureStorage] Failed to fetch ${key}`, e);
                // Fallback: keep value from AsyncStorage if present
             }
           }
        }

        // Return stringified merged state
        return JSON.stringify(state);
      } catch (e) {
        console.error('Failed to parse state', e);
        return json;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        try {
            const state = JSON.parse(value);

            // 3. Extract and save sensitive keys to SecureStore
            if (Platform.OS !== 'web') {
                for (const key of sensitiveKeys) {
                    if (state.state && state.state[key] !== undefined) {
                        const val = state.state[key];
                        try {
                            // Only string values can be stored in SecureStore easily.
                            // If it's null, we remove it.
                            if (val === null) {
                                await SecureStore.deleteItemAsync(`${name}-${key}`);
                            } else {
                                await SecureStore.setItemAsync(`${name}-${key}`, String(val));
                            }

                            // Remove from the object to be saved in AsyncStorage ONLY if SecureStore succeeded
                            // This ensures that if SecureStore fails, we fall back to AsyncStorage (plaintext but safe from data loss)
                            state.state[key] = null;
                        } catch (e) {
                            console.warn(`[SecureStorage] Failed to save ${key}`, e);
                            // Do NOT clear key from state.state, so it persists in AsyncStorage
                        }
                    }
                }
            }

            // 4. Save the rest to AsyncStorage
            await AsyncStorage.setItem(name, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save state', e);
        }
    },
    removeItem: async (name: string): Promise<void> => {
        await AsyncStorage.removeItem(name);
        if (Platform.OS !== 'web') {
            for (const key of sensitiveKeys) {
                await SecureStore.deleteItemAsync(`${name}-${key}`);
            }
        }
    },
  };
};
