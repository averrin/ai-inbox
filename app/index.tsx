import { View, Text, BackHandler } from 'react-native';
import { useShareIntent, ShareIntent } from 'expo-share-intent';
import { useSettingsStore } from '../store/settings';
import SetupScreen from '../components/SetupScreen';
import ProcessingScreen from '../components/ProcessingScreen';
import HistoryScreen from '../components/HistoryScreen';
import { useEffect, useState } from 'react';

export default function Home() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({
    debug: true,
    resetOnBackground: true,
  });
  const { apiKey, vaultUri } = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);
  const [resetKey, setResetKey] = useState(0); // Key to force re-mount/reset

  // Basic hydration check or just reliance on Zustand persist (sync storage usually fast enough for UI)
  const isConfigured = !!apiKey && !!vaultUri;

  if (!isConfigured || showSettings) {
    return <SetupScreen onClose={() => setShowSettings(false)} canClose={isConfigured} />;
  }

  if (hasShareIntent && (shareIntent.type === 'text' || shareIntent.type === 'weburl' || shareIntent.type === 'media' || shareIntent.webUrl || shareIntent.text || (shareIntent.files && shareIntent.files.length > 0))) {
     return <ProcessingScreen 
        shareIntent={shareIntent} 
        onReset={resetShareIntent} 
        onOpenSettings={() => setShowSettings(true)} 
     />;
  }

  // Direct open: Show "Take Note" UI
  const emptyIntent: ShareIntent = { type: 'text', text: '', webUrl: '', files: null };
  
  return <ProcessingScreen 
    key={resetKey}
    shareIntent={emptyIntent} 
    onReset={() => BackHandler.exitApp()} 
    onOpenSettings={() => setShowSettings(true)}
  />;
}
