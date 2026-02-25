import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore - Ignore type error for getReactNativePersistence as it might be missing in this firebase version's types
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import googleServices from '../app/google-services.json';

// Extracted from app/google-services.json
const client = googleServices.client[0];
export const firebaseConfig = {
    apiKey: client.api_key[0].current_key,
    authDomain: `${googleServices.project_info.project_id}.firebaseapp.com`,
    projectId: googleServices.project_info.project_id,
    storageBucket: googleServices.project_info.storage_bucket,
    messagingSenderId: googleServices.project_info.project_number,
    appId: client.client_info.mobilesdk_app_id
};

// Initialize Firebase
let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Initialize Auth with AsyncStorage persistence
    initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
} else {
    app = getApp();
}

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
// Force long polling to avoid WebSocket issues on RN Android
export const firebaseDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});
