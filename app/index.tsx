import { View, Text, BackHandler } from 'react-native';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import { useSettingsStore } from '../store/settings';
import SetupScreen from '../components/SetupScreen';
import ProcessingScreen from '../components/ProcessingScreen';
import { useEffect, useState } from 'react';

export default function Home() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: true,
    resetOnBackground: false,
  });
  const { apiKey, vaultUri } = useSettingsStore();
  const [resetKey, setResetKey] = useState(0); // Key to force re-mount/reset

  useEffect(() => {
    // Hydrate Google Auth State
    const { hydrate } = require('../store/googleStore').useGoogleStore.getState();
    hydrate();
  }, []);

  // Basic hydration check or just reliance on Zustand persist (sync storage usually fast enough for UI)
  const isConfigured = !!apiKey && !!vaultUri;

  if (!isConfigured) {
    return <SetupScreen canClose={false} />;
  }

  // Unify intent handling to allow ProcessingScreen to react to prop updates
  // (Fixes race condition where share intent arrives after mount)
  const effectiveIntent = (hasShareIntent && (shareIntent.type === 'text' || shareIntent.type === 'weburl' || shareIntent.type === 'media' || shareIntent.webUrl || shareIntent.text || (shareIntent.files && shareIntent.files.length > 0)))
      ? shareIntent
      : { type: 'text', text: '', webUrl: '', files: null } as ShareIntent;

  return <ProcessingScreen 
    key={`processing-${resetKey}`}
    shareIntent={effectiveIntent}
    onReset={() => {
        if (hasShareIntent) {
            resetShareIntent();
        } else {
            BackHandler.exitApp();
        }
    }}
  />;
}
