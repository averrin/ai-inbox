import "../global.css";
import { Slot } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef } from "react";

WebBrowser.maybeCompleteAuthSession();
import { registerReminderTask, scanForReminders, Reminder, getHash } from "../services/reminderService";
import { registerJulesTask, unregisterJulesTask } from "../services/jules";
import { useSettingsStore } from "../store/settings";
import { ReminderModalProvider, useReminderModal } from "../utils/reminderModalContext";
import { ReminderModal } from "../components/ReminderModal";
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { LogBox, View, Text, Platform } from 'react-native';
import { SyncService } from "../services/syncService";

// Suppress deprecation warnings from dependencies
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'expo-av: Expo AV has been deprecated',
  'expo-background-fetch: This library is deprecated',
  'React Native Firebase namespaced API',
  'Method called was onAuthStateChanged',
  'Method called was initializeApp',
  'getApp() instead',
]);

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#22c55e', backgroundColor: '#1e293b', borderBottomColor: '#334155', borderBottomWidth: 1 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: 'bold',
        color: '#f8fafc'
      }}
      text2Style={{
        fontSize: 13,
        color: '#cbd5e1'
      }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: '#ef4444', backgroundColor: '#1e293b', borderBottomColor: '#334155', borderBottomWidth: 1 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: 'bold',
        color: '#f8fafc'
      }}
      text2Style={{
        fontSize: 13,
        color: '#cbd5e1'
      }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: '#3b82f6', backgroundColor: '#1e293b', borderBottomColor: '#334155', borderBottomWidth: 1 }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: 'bold',
        color: '#f8fafc'
      }}
      text2Style={{
        fontSize: 13,
        color: '#cbd5e1'
      }}
    />
  )
};

function AppContent() {
  const { activeReminder, showReminder, closeReminder } = useReminderModal();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (lastNotificationResponse) {
      const { fileUri, reminder } = lastNotificationResponse.notification.request.content.data || {};
      if (reminder) {
        showReminder(reminder as Reminder);
      } else if (fileUri) {
        scanForReminders().then(reminders => {
          const found = reminders.find(r => r.fileUri === fileUri);
          if (found) {
            showReminder(found);
          }
        });
      }
    }
  }, [lastNotificationResponse]);

  useEffect(() => {
    // Initialize SyncService
    SyncService.getInstance();

    // Register background task on app launch
    registerReminderTask();

    // Listen for notifications when app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // When a reminder notification is received while app is open, show modal instead
      const { fileUri, reminder } = notification.request.content.data || {};

      if (reminder) {
        // Instant show if we have the data
        showReminder(reminder as Reminder);
      } else if (fileUri) {
        // Fallback to scan if legacy notification
        scanForReminders().then(reminders => {
          const found = reminders.find(r => r.fileUri === fileUri);
          if (found) {
            showReminder(found);
          }
        });
      }
    });

    // Listen for notification taps (when app is already open)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const { fileUri, reminder } = response.notification.request.content.data || {};

      if (reminder) {
        showReminder(reminder as Reminder);
      } else if (fileUri) {
        scanForReminders().then(reminders => {
          const found = reminders.find(r => r.fileUri === fileUri);
          if (found) {
            showReminder(found);
          }
        });
      }
    });

    // Check for Native Alarm Launch
    if (Platform.OS === 'android') {
      // Set up notification channels for Android
      Notifications.setNotificationChannelAsync('jules-artifacts', {
        name: 'Jules Artifacts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#818cf8',
      });
      
      import('../services/alarmModule').then(async ({ getLaunchAlarmDetails, dismissNativeNotification }) => {
        const details = await getLaunchAlarmDetails();
        if (details) {
          console.log("[App] Launched via Native Alarm:", details.title);
          // Dismiss the persistent notification
          await dismissNativeNotification(details.id);

          // Try to find the real file first for full functionality
          const reminders = await scanForReminders();
          const found = reminders.find(r => (Math.abs(getHash(r.fileUri)) % 2147483647) === details.id);

          if (found) {
            showReminder(found);
          } else {
            // Fallback: Construct a transient reminder object from the intent extras
            // so the modal can show SOMETHING immediately even if file read fails.
            console.log("[App] File scan failed/miss, using intent details for modal");

            showReminder({
              fileUri: '', // No file access
              fileName: details.title || 'Alarm',
              reminderTime: new Date(details.id * 1000).toISOString(),
              content: details.message || '',
              alarm: true
            } as Reminder);
          }
        }
      });
    }

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  const { julesNotificationsEnabled } = useSettingsStore();

  useEffect(() => {
    if (julesNotificationsEnabled) {
      registerJulesTask();
    } else {
      unregisterJulesTask();
    }
  }, [julesNotificationsEnabled]);

  return (
    <>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <Slot />
      <ReminderModal
        reminder={activeReminder}
        onClose={closeReminder}
      />
      {__DEV__ && (
        <View style={{ position: 'absolute', bottom: 50, right: 10, backgroundColor: 'rgba(220, 38, 38, 0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 999 }} pointerEvents="none">
          <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>DEBUG</Text>
        </View>
      )}
      <Toast config={toastConfig} />
    </>
  );
}

export default function Layout() {
  return (
    <ReminderModalProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ShareIntentProvider options={{ debug: false, resetOnBackground: true }}>
          <AppContent />
        </ShareIntentProvider>
      </GestureHandlerRootView>
    </ReminderModalProvider>
  );
}
