import { BackHandler } from 'react-native';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import BottomTabNavigator from '../components/navigation/BottomTabNavigator';
import { useEffect } from 'react';

export default function Home() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: false,
    resetOnBackground: false,
  });

  useEffect(() => {
    // Hydrate Google Auth State
    const { hydrate } = require('../store/googleStore').useGoogleStore.getState();
    hydrate();
  }, []);

  // Unify intent handling to allow ProcessingScreen to react to prop updates
  const effectiveIntent = (hasShareIntent && (shareIntent.type === 'text' || shareIntent.type === 'weburl' || shareIntent.type === 'media' || shareIntent.webUrl || shareIntent.text || (shareIntent.files && shareIntent.files.length > 0)))
      ? shareIntent
      : { type: 'text', text: '', webUrl: '', files: null } as ShareIntent;

  const handleReset = () => {
    if (hasShareIntent) {
      resetShareIntent();
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
