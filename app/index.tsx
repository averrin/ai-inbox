import { BackHandler } from 'react-native';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import BottomTabNavigator from '../components/navigation/BottomTabNavigator';
import { useEffect, useState } from 'react';

export default function Home() {
  const { hasShareIntent, shareIntent, resetShareIntent, isReady } = useShareIntent({
    debug: false,
    resetOnBackground: true,
  });

  const [localShareIntent, setLocalShareIntent] = useState<ShareIntent | null>(null);

  useEffect(() => {
    // Hydrate Google Auth State
    const { hydrate } = require('../store/googleStore').useGoogleStore.getState();
    hydrate();
  }, []);

  // "Consume" the intent: if present, save to local state and reset the native one.
  useEffect(() => {
    if (hasShareIntent && shareIntent.type && (shareIntent.text || shareIntent.webUrl || (shareIntent.files && shareIntent.files.length > 0))) {
      console.log("[Home] Consuming Share Intent:", shareIntent.type);
      setLocalShareIntent(shareIntent);
      resetShareIntent();
    }
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  // Use local intent if available, otherwise fallback to empty default
  const effectiveIntent = localShareIntent || { type: 'text', text: '', webUrl: '', files: null } as ShareIntent;

  const handleReset = () => {
    if (localShareIntent) {
      setLocalShareIntent(null);
    } else {
      BackHandler.exitApp();
    }
  };

  // Prevent flash of empty input while still checking for initial intent on launch
  if (!isReady && !localShareIntent) {
    return null; // Or a SplashScreen/Loading view
  }

  return (
    <BottomTabNavigator 
      shareIntent={effectiveIntent}
      onReset={handleReset}
    />
  );
}
