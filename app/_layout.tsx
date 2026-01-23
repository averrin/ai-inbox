import "../global.css";
import { Slot } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from "react";
import { registerReminderTask, scanForReminders, Reminder } from "../services/reminderService";
import { ReminderModalProvider, useReminderModal } from "../utils/reminderModalContext";
import { ReminderModal } from "../components/ReminderModal";
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { LogBox, View, Text } from 'react-native';

// Suppress deprecation warnings from dependencies
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'expo-av: Expo AV has been deprecated',
  'expo-background-fetch: This library is deprecated',
]);

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
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

    // Listen for notification taps (when app opened from notification)
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

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return (
    <>
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
      <ShareIntentProvider>
        <AppContent />
      </ShareIntentProvider>
    </ReminderModalProvider>
  );
}
