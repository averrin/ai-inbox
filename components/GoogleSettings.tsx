import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useSettingsStore } from '../store/settings';
import { useGoogleStore } from '../store/googleStore';

WebBrowser.maybeCompleteAuthSession();

export function GoogleSettings() {
    const { isConnected, email, setAuth, clearAuth } = useGoogleStore();
    const { googleAndroidClientId, googleIosClientId, googleWebClientId } = useSettingsStore();

    const [request, response, promptAsync] = Google.useAuthRequest({
        androidClientId: googleAndroidClientId || undefined,
        iosClientId: googleIosClientId || undefined,
        webClientId: googleWebClientId || undefined, // Fallback usually
        scopes: ['https://www.googleapis.com/auth/tasks'],
    });

    useEffect(() => {
        if (response?.type === 'success') {
            const { authentication } = response;
            if (authentication?.accessToken) {
                // In a real app, you'd fetch user profile here to get email
                setAuth(authentication.accessToken, authentication.refreshToken || null, 'Connected User');
            }
        }
    }, [response]);

    return (
        <View className="mb-6">
            <Text className="text-xl font-bold text-white mb-2">Google Integration</Text> 
            <View className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <Text className="text-indigo-200 font-semibold mb-2">Google Tasks</Text>
                
                {isConnected ? (
                    <View>
                        <Text className="text-white mb-3">
                            <Text className="text-green-400">● Connected</Text> {email && `as ${email}`}
                        </Text>
                         <Text className="text-slate-400 text-sm mb-4">
                            AI can create tasks in your default list.
                        </Text>
                        <TouchableOpacity 
                            onPress={clearAuth}
                            className="bg-red-500/20 border border-red-500/50 py-3 rounded-lg items-center"
                        >
                            <Text className="text-red-300 font-semibold">Disconnect</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                     <View>
                        <Text className="text-slate-400 text-sm mb-4">
                            Connect to allow AI to create tasks for you.
                        </Text>
                        <TouchableOpacity 
                            disabled={!request}
                            onPress={() => promptAsync()}
                            className="bg-indigo-600 py-3 rounded-lg items-center"
                        >
                            <Text className="text-white font-semibold">Connect Google Tasks</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
