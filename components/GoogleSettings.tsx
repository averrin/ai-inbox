import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSettingsStore } from '../store/settings';
import { useGoogleStore } from '../store/googleStore';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleSettingsProps {
    androidClientId?: string;
}

export function GoogleSettings({ androidClientId }: GoogleSettingsProps) {
    const { isConnected, email, setAuth, clearAuth } = useGoogleStore();
    const settings = useSettingsStore();
    
    // Use props if provided (preview mode), otherwise use store
    const effectiveAndroidId = androidClientId !== undefined ? androidClientId : settings.googleAndroidClientId;


    const [request, response, promptAsync] = Google.useAuthRequest({
        androidClientId: effectiveAndroidId || "placeholder_id",
        scopes: [
            'https://www.googleapis.com/auth/tasks',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile'
        ],
        redirectUri: makeRedirectUri({
            scheme: 'com.aiinbox.mobile'
        }),
    });

    useEffect(() => {
        if (response?.type === 'success') {
            const { authentication } = response;
            if (authentication?.accessToken) {
                const fetchUserInfo = async () => {
                    try {
                        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                            headers: { Authorization: `Bearer ${authentication.accessToken}` }
                        });
                        const userData = await userRes.json();
                        const userName = userData.email || userData.name || 'Connected User';
                        setAuth(authentication.accessToken, authentication.refreshToken || null, userName);
                    } catch (e) {
                        console.warn('Failed to fetch user info:', e);
                        setAuth(authentication.accessToken, authentication.refreshToken || null, 'Connected User');
                    }
                };
                fetchUserInfo();
            }
        }
    }, [response]);

    const isConfigured = !!effectiveAndroidId;

    return (
        <View>
            <View className="bg-slate-800 rounded-xl p-4 border border-slate-700">

                
                {isConnected ? (
                    <View>
                        <Text className="text-white mb-3">
                            <Text className="text-green-400">● Connected</Text> {email && `as ${email}`}
                        </Text>
                         <Text className="text-slate-400 text-sm mb-4">
                            AI can schedule events in your primary calendar.
                        </Text>
                        <View className="flex-row gap-3">
                            <TouchableOpacity 
                                onPress={clearAuth}
                                className="flex-1 bg-red-500/20 border border-red-500/50 py-3 rounded-lg items-center"
                            >
                                <Text className="text-red-300 font-semibold">Disconnect</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={async () => {
                                    clearAuth();
                                    promptAsync();
                                }}
                                className="flex-1 bg-indigo-600/20 border border-indigo-500/50 py-3 rounded-lg items-center"
                            >
                                <Text className="text-indigo-300 font-semibold">Reconnect</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                     <View>
                        <Text className="text-slate-400 text-sm mb-4">
                            Connect to allow AI to schedule events for you.
                        </Text>
                        {isConfigured ? (
                            <TouchableOpacity 
                                disabled={!request}
                                onPress={() => promptAsync()}
                                className="bg-indigo-600 py-3 rounded-lg items-center"
                            >
                                <Text className="text-white font-semibold">Connect Google Calendar</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="bg-yellow-500/10 border border-yellow-500/50 p-3 rounded-lg">
                                <Text className="text-yellow-200 text-sm text-center">
                                    Please enter your Client ID above to enable Google Calendar integration.
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
}
