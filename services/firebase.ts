import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your Firebase configuration
// Extracted from google-services.json
export const firebaseConfig = {
    apiKey: "AIzaSyBzbGxBZFXK2dP1F-w0iGMMqkMCf2Rgvps",
    authDomain: "gen-lang-client-0022630096.firebaseapp.com",
    projectId: "gen-lang-client-0022630096",
    storageBucket: "gen-lang-client-0022630096.firebasestorage.app",
    messagingSenderId: "761766309334",
    appId: "1:761766309334:android:7588bfcea0e404e7928877"
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
