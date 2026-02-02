import { BackHandler } from 'react-native';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import BottomTabNavigator from '../components/navigation/BottomTabNavigator';
import { useEffect, useState } from 'react';

export default function Home() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: false,
    resetOnBackground: false,
  });

  const [localShareIntent, setLocalShareIntent] = useState<ShareIntent | null>(null);

  useEffect(() => {
    // Hydrate Google Auth State
    const { hydrate } = require('../store/googleStore').useGoogleStore.getState();
    hydrate();
  }, []);

  // "Consume" the intent: if present, save to local state and reset the native one.
  useEffect(() => {
    if (hasShareIntent && shareIntent.type) {
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

  return (
    <BottomTabNavigator 
      shareIntent={effectiveIntent}
      onReset={handleReset}
    />
  );
}
