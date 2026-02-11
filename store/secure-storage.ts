import { StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const createSecureStorage = (sensitiveKeys: string[]): StateStorage => {
  let hasReadError = false;

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
                console.log(`[SecureStorage] Loaded sensitive key: ${key}`);
                state.state[key] = secureValue;
              } else if (state.state) {
                // Key is null in SecureStore or not found.
                // If it's not found, it might be truly null.
                // But we should be careful.
              }
            } catch (e) {
              console.error(`[SecureStorage] CRITICAL: Failed to fetch ${key} from SecureStore`, e);
              // Flag that we had a read error so we don't delete keys in setItem
              hasReadError = true;
              // We re-throw or return null?
              // If we return null here, zustand sees "no state". 
              // If we swallow it, we risk partial state.
              // But now we have protection in setItem.
              // So partial state is OKAY as long as we don't save over it.
              // BUT, if the user sees "empty settings", they might re-enter them.
              // If they re-enter them, setItem will be called with NEW values (not null).
              // So partial state is arguably okay IF we warn the user?
              // No, better to fail and force default state so it's obvious something is wrong?
              // Actually, if we return `json` (AsyncStorage state) with nulls, the UI will show empty fields.
              // User enters new key -> setItem called with new key -> Saved.
              // User does NOT enter new key -> setItem called with null -> Skipped due to hasReadError.
              // THIS IS SAFE!
            }
          }
        }

        // Return stringified merged state
        return JSON.stringify(state);
      } catch (e) {
        console.error('[SecureStorage] Failed to parse state or load sensitive keys', e);
        // We return NULL here so zustand sees "no state" and might try to use default initial state?
        // Or better: we should probably re-throw if we want to crash and burn rather than corrupt data.
        // But zustand might not handle re-throw well during hydration.
        // Returning null might be safer than returning a state with missing keys.
        return null;
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
                  if (hasReadError) {
                    console.warn(`[SecureStorage] SKIPPING DELETE of ${key} because of previous read error`);
                  } else {
                    console.log(`[SecureStorage] Deleting sensitive key: ${key}`);
                    await SecureStore.deleteItemAsync(`${name}-${key}`);
                  }
                } else {
                  console.log(`[SecureStorage] Saving sensitive key: ${key}`);
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
