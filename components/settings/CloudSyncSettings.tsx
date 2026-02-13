import { ServiceAuth } from './ServiceAuth';
import { SyncService } from '../../services/syncService';
import { firebaseAuth } from '../../services/firebase';
import { useState, useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthService } from '../../services/googleAuth';
import { onAuthStateChanged } from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export const CloudSyncSettings = () => {
    const [user, setUser] = useState(firebaseAuth.currentUser);
    const [request, response, promptAsync] = Google.useAuthRequest(GoogleAuthService.getConfig());

    useEffect(() => {
        if (request) {
            console.log('[CloudSyncSettings] Auth request created:', request.url);
        }
    }, [request]);

    useEffect(() => {
        console.log('[CloudSyncSettings] Mounted. Current Firebase user:', firebaseAuth.currentUser?.email || 'None');
        const subscriber = onAuthStateChanged(firebaseAuth, (u) => {
            console.log('[CloudSyncSettings] Auth state changed:', u?.email || 'None');
            setUser(u);
        });
        return subscriber;
    }, []);

    const exchangeCode = async (code: string, request: any) => {
        try {
            console.log('[CloudSyncSettings] Exchanging code for tokens...');
            const codeVerifier = request.codeVerifier;
            const config = GoogleAuthService.getConfig();
            
            if (!codeVerifier) {
                console.warn('[CloudSyncSettings] No code verifier found in request object.');
                return;
            }

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    code: code,
                    client_id: config.clientId || '',
                    redirect_uri: config.redirectUri || '',
                    grant_type: 'authorization_code',
                    code_verifier: codeVerifier,
                }).toString(),
            });

            const data = await response.json();
            console.log('[CloudSyncSettings] Token exchange response status:', response.status);

            if (data.id_token) {
                console.log('[CloudSyncSettings] Successfully exchanged code for id_token');
                SyncService.getInstance().signInWithGoogle(data.id_token)
                    .then(() => console.log('[CloudSyncSettings] Firebase sign-in success'))
                    .catch(e => console.error('[CloudSyncSettings] Firebase sign-in failure:', e));
            } else {
                console.warn('[CloudSyncSettings] Token exchange failed. No id_token.', data);
            }
        } catch (error) {
            console.error('[CloudSyncSettings] Token exchange error:', error);
        }
    };

    const handleResponse = (res: any) => {
        if (res?.type === 'success') {
            const idToken = res.params.id_token || res.authentication?.idToken;
            const accessToken = res.params.access_token || res.authentication?.accessToken;
            const code = res.params.code;
            
            console.log('[CloudSyncSettings] OAuth Result success. ID Token:', !!idToken, 'Access Token:', !!accessToken, 'Code:', !!code);
            
            if (idToken) {
                SyncService.getInstance().signInWithGoogle(idToken)
                    .then(() => console.log('[CloudSyncSettings] Firebase sign-in success'))
                    .catch(e => console.error('[CloudSyncSettings] Firebase sign-in failure:', e));
            } else if (code && request) {
                console.log('[CloudSyncSettings] Authorization Code found. Proceeding to exchange.');
                exchangeCode(code, request);
            } else if (accessToken) {
                console.warn('[CloudSyncSettings] Only accessToken found. Firebase needs idToken. params:', JSON.stringify(res.params));
            } else {
                console.warn('[CloudSyncSettings] No idToken or Code found. params:', JSON.stringify(res.params));
            }
        }
    };

    useEffect(() => {
        if (response) {
            console.log('[CloudSyncSettings] response state change:', response.type);
            handleResponse(response);
        }
    }, [response]);

    const handleSignOut = () => {
        SyncService.getInstance().signOut();
    };

    const handleConnect = () => {
        console.log('[CloudSyncSettings] Button pressed, calling promptAsync...');
        promptAsync()
            .then(res => {
                console.log('[CloudSyncSettings] promptAsync finished with type:', res?.type);
                handleResponse(res);
            })
            .catch(err => {
                console.error('[CloudSyncSettings] promptAsync error:', err);
            });
    };

    return (
        <ServiceAuth
            title="Cloud Sync (Experimental)"
            description="Sync your settings and API keys across devices using your Google Account."
            icon="cloud-circle"
            isConnected={!!user}
            connectedText={`Synced as ${user?.email}`}
            onConnect={handleConnect}
            onDisconnect={handleSignOut}
            connectButtonText="Connect Google Account"
            disconnectButtonText="Sign Out"
            isDisabled={!request}
            iconColor="#60a5fa"
        />
    );
}
