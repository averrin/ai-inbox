import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { firebaseDb, firebaseAuth } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getCalendars } from 'expo-localization';

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });

        // Also set up a channel for silent FCM messages
        await Notifications.setNotificationChannelAsync('silent_fcm', {
            name: 'Silent System Messages',
            importance: Notifications.AndroidImportance.LOW,
            vibrationPattern: [0, 0],
            showBadge: false,
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
    }

    try {
        // Use device push token mapping to get the raw FCM token
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data;

        // Save the raw token to Firestore if user is logged in
        const user = firebaseAuth.currentUser;
        if (token && user) {
            console.log("Storing FCM token in Firestore for user", user.uid);
            await setDoc(doc(firebaseDb, 'users', user.uid, 'config', 'fcm'), {
                token: token,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Sync device timezone for backend reminder delivery
            try {
                const timezone = getCalendars()[0]?.timeZone || 'UTC';
                await setDoc(doc(firebaseDb, 'users', user.uid, 'config', 'device'), {
                    timezone,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (tzErr) {
                console.error("Error syncing timezone", tzErr);
            }
        } else if (token) {
            console.log("Got FCM token but no user logged in, token not stored yet");
        }
    } catch (e) {
        console.error("Error getting or storing push token", e);
    }

    return token;
}
