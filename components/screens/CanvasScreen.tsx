import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Layout } from '../ui/Layout';
import { Colors } from '../ui/design-tokens';

export default function CanvasScreen() {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <Layout fullBleed={true}>
      <View style={styles.container}>
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
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
