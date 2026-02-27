import "../global.css";
import { initLogger } from "../utils/logger";
// Initialize logger early
initLogger();

import { Slot } from "expo-router";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useRef } from "react";

WebBrowser.maybeCompleteAuthSession();
import { scanForReminders, Reminder } from "../services/reminderService";
import { ReminderModalProvider, useReminderModal } from "../utils/reminderModalContext";
import { ReminderModal } from "../components/ReminderModal";
import { GlobalAlerts } from '../components/GlobalAlerts';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { LogBox, View, Text, Platform } from 'react-native';
import { SyncService } from "../services/syncService";
import { watcherService } from "../services/watcherService";
import { Colors, Spacing, Typography } from '../components/ui/design-tokens';
import { registerForPushNotificationsAsync } from '../services/pushNotifications';
import { useSettingsStore } from '../store/settings';

// Suppress deprecation warnings from dependencies
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'expo-av: Expo AV has been deprecated',
  'React Native Firebase namespaced API',
  'Method called was onAuthStateChanged',
  'Method called was initializeApp',
  'getApp() instead',
]);

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Suppress sound and banner for progress updates to avoid spam
    const isProgress = notification.request.content.data?.type === 'progress';
    const isHeartbeat = notification.request.content.data?.type === 'heartbeat';

    return {
      shouldPlaySound: !isProgress && !isHeartbeat,
      shouldSetBadge: false,
      shouldShowBanner: !isProgress && !isHeartbeat,
      shouldShowList: !isHeartbeat, // Keep progress in tray, but not heartbeat
      priority: isProgress || isHeartbeat ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: Colors.success, backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: 1 }}
      contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding }}
      text1Style={{
        fontSize: Typography.sizes.base,
        fontWeight: 'bold',
        color: Colors.text.primary
      }}
      text2Style={{
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary
      }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: Colors.error, backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: 1 }}
      contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding }}
      text1Style={{
        fontSize: Typography.sizes.base,
        fontWeight: 'bold',
        color: Colors.text.primary
      }}
      text2Style={{
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary
      }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: Colors.info, backgroundColor: Colors.surface, borderBottomColor: Colors.border, borderBottomWidth: 1 }}
      contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding }}
      text1Style={{
        fontSize: Typography.sizes.base,
        fontWeight: 'bold',
        color: Colors.text.primary
      }}
      text2Style={{
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary
      }}
    />
  )
};

function AppContent() {
  useKeepAwake();
  const { activeReminder, showReminder, closeReminder } = useReminderModal();
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (lastNotificationResponse) {
      watcherService.handleNotificationResponse(lastNotificationResponse);
      const { fileUri, reminder } = lastNotificationResponse.notification.request.content.data || {};
      if (reminder) {
        showReminder(reminder as unknown as Reminder);
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

    // Initialize WatcherService
    watcherService.init();

    // Register for push notifications
    registerForPushNotificationsAsync();

    // Listen for notifications when app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // Handle Heartbeat
      const { fileUri, reminder, type, timestamp } = notification.request.content.data || {};

      if (type === 'heartbeat') {
        const { setLastFcmHeartbeat } = useSettingsStore.getState();
        setLastFcmHeartbeat(timestamp ? parseInt(timestamp as string) : Date.now());
        return;
      }

      if (type === 'reminder') {
        const reminderData = notification.request.content.data as any;
        if (reminderData.title) {
          showReminder({
            id: reminderData.reminderId || '',
            fileUri: reminderData.reminderId || '',
            fileName: reminderData.title,
            title: reminderData.title,
            reminderTime: reminderData.reminderTime || new Date().toISOString(),
            content: reminderData.content || '',
          });
        }
        return;
      }

      if (type === 'mood_daily' || type === 'range_start') {
        // Just let the notification show
        return;
      }

      if (type === 'github_run_progress') {
        const { runId, percent, remainingMins, runName, headBranch, owner, repo } = notification.request.content.data as any;
        watcherService.handleProgressUpdate(
          Number(runId), Number(percent), Number(remainingMins),
          runName, headBranch, owner, repo
        );
        return;
      }

      if (type === 'github_run' && (notification.request.content.data as any).status === 'completed') {
        const { runId, conclusion, runName, artifactPath } = notification.request.content.data as any;
        watcherService.handleRunCompleted(Number(runId), conclusion, runName, artifactPath);
        return;
      }

      if (type === 'github_run_download_progress') {
        const { runId, progress } = notification.request.content.data as any;
        watcherService.handleDownloadProgress(Number(runId), Number(progress));
        return;
      }

      if (type === 'github_run_download_finished') {
        const { runId } = notification.request.content.data as any;
        watcherService.handleDownloadFinished(Number(runId));
        return;
      }

      if (reminder) {
        // Instant show if we have the data
        showReminder(reminder as unknown as Reminder);
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
      watcherService.handleNotificationResponse(response);
      const { fileUri, reminder } = response.notification.request.content.data || {};

      if (reminder) {
        showReminder(reminder as unknown as Reminder);
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
      <StatusBar style="light" backgroundColor={Colors.transparent} translucent />
      <Slot />
      <GlobalAlerts />
      <ReminderModal
        reminder={activeReminder}
        onClose={closeReminder}
      />
      {__DEV__ && (
        <View style={{ position: 'absolute', bottom: 50, right: 10, backgroundColor: Colors.debug, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 999 }} pointerEvents="none">
          <Text style={{ color: Colors.white, fontSize: Typography.sizes.xs, fontWeight: 'bold' }}>DEBUG</Text>
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
