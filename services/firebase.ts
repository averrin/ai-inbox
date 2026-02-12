import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
// Extracted from google-services.json
export const firebaseConfig = {
    apiKey: "REDACTED_FIREBASE_API_KEY",
    authDomain: "REDACTED_FIREBASE_PROJECT_ID.firebaseapp.com",
    projectId: "REDACTED_FIREBASE_PROJECT_ID",
    storageBucket: "REDACTED_FIREBASE_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "REDACTED_FIREBASE_SENDER_ID",
    appId: "1:REDACTED_FIREBASE_SENDER_ID:android:REDACTED_FIREBASE_APP_ID_SUFFIX"
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
