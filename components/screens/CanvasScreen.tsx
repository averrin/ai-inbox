import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Layout } from '../ui/Layout';
import { Colors } from '../ui/design-tokens';

export default function CanvasScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();

  // Bottom tab bar height is approx 52 (44 icon + 8 padding) + 4 bottom offset
  // We add a bit more (60) to ensure safe clearance for touch targets
  const bottomPadding = insets.bottom + 60;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.white }}>
      <View style={[styles.container, { paddingBottom: bottomPadding }]}>
        <WebView
          source={{ uri: 'https://www.tldraw.com/' }}
          style={styles.webview}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="always"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          // Set background color to match app theme to avoid white flash
          containerStyle={{ backgroundColor: Colors.background }}
        />
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.transparent,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
