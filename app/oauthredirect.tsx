import { View, Text, TouchableOpacity } from "react-native";
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from "react";
import { router } from "expo-router";

export default function OAuthRedirect() {
    useEffect(() => {
        console.log('[OAuthRedirect] Mounted, attempting to complete auth session...');
        WebBrowser.maybeCompleteAuthSession();
        
        // Auto-redirect back to settings/home after a short delay
        const timer = setTimeout(() => {
            console.log('[OAuthRedirect] session completion timed out/finished, redirecting home...');
            router.replace('/');
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: 'white', fontSize: 18, marginBottom: 20 }}>Completing login...</Text>
            <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 20 }}>
                Returning you to the app...
            </Text>
        </View>
    );
}
