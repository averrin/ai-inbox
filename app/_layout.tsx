import "../global.css";
import { Slot } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import * as Notifications from 'expo-notifications';
import { useEffect } from "react";
import { registerReminderTask } from "../services/reminderService";

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

export default function Layout() {

  useEffect(() => {
    // Register background task on app launch
    registerReminderTask();
  }, []);

  return (
    <ShareIntentProvider>
      <Slot />
    </ShareIntentProvider>
  );
}
