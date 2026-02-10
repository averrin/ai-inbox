import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { StateStorage } from 'zustand/middleware';

// Default implementations to allow easy use without DI
const defaultSecureStore = SecureStore;
const defaultAsyncStorage = AsyncStorage;
const defaultPlatform = Platform;

export const createSecureStorage = (
  sensitiveKeys: string[],
  secureStoreImpl = defaultSecureStore,
  asyncStoreImpl = defaultAsyncStorage,
  platformImpl = defaultPlatform
): StateStorage => {
  const isWeb = platformImpl.OS === 'web';

  return {
    getItem: async (name: string): Promise<string | null> => {
      // If web, just delegate to AsyncStorage
      if (isWeb) {
        return asyncStoreImpl.getItem(name);
      }

      const json = await asyncStoreImpl.getItem(name);
      if (!json) {
        return null;
      }

      const state = JSON.parse(json);
      // Ensure 'state' property exists as Zustand persists { state: ... , version: ... }
      if (!state || !state.state) {
        return json;
      }

      let hasMigration = false;
      for (const key of sensitiveKeys) {
        const secureKey = `${name}-${key}`;
        // secureStoreImpl usually has getItemAsync (Expo SecureStore)
        const secureValue = await secureStoreImpl.getItemAsync(secureKey);

        if (secureValue !== null) {
          // Found in SecureStore, use it
          state.state[key] = secureValue;
        } else if (state.state[key]) {
          // Not in SecureStore, but present in AsyncStorage. Migrate!
          // We only migrate non-null/non-empty values.
          await secureStoreImpl.setItemAsync(secureKey, state.state[key]);
          hasMigration = true;
        }
      }

      if (hasMigration) {
        // If we migrated, remove sensitive data from AsyncStorage
        const cleanState = { ...state, state: { ...state.state } };
        for (const key of sensitiveKeys) {
          delete cleanState.state[key];
        }
        await asyncStoreImpl.setItem(name, JSON.stringify(cleanState));
      }

      return JSON.stringify(state);
    },

    setItem: async (name: string, value: string): Promise<void> => {
      // If web, just delegate to AsyncStorage
      if (isWeb) {
        return asyncStoreImpl.setItem(name, value);
      }

      const state = JSON.parse(value);
      if (!state || !state.state) {
        await asyncStoreImpl.setItem(name, value);
        return;
      }

      for (const key of sensitiveKeys) {
        const secureKey = `${name}-${key}`;
        if (state.state[key]) {
          await secureStoreImpl.setItemAsync(secureKey, state.state[key]);
          delete state.state[key];
        } else {
          // If value is missing/null/empty, remove from SecureStore to stay in sync
          await secureStoreImpl.deleteItemAsync(secureKey);
        }
      }

      await asyncStoreImpl.setItem(name, JSON.stringify(state));
    },

    removeItem: async (name: string): Promise<void> => {
      await asyncStoreImpl.removeItem(name);
      if (!isWeb) {
        for (const key of sensitiveKeys) {
          await secureStoreImpl.deleteItemAsync(`${name}-${key}`);
        }
      }
    },
  };
};
