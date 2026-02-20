import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { useMoodStore } from '../store/moodStore';
import { Platform } from 'react-native';
import { scheduleNativeAlarm, stopNativeAlarm, cancelAllNativeAlarms } from './alarmModule';
import dayjs from 'dayjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    Timestamp
} from 'firebase/firestore';
import { firebaseDb, firebaseAuth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

import Toast from 'react-native-toast-message';

export const REMINDER_PROPERTY_KEY = 'reminder';
export const ALARM_PROPERTY_KEY = 'alarm';
export const PERSISTENT_PROPERTY_KEY = 'persistent';
export const RECURRENT_PROPERTY_KEY = 'recurrent';

export function getHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

const REMINDER_TASK_NAME = 'BACKGROUND_REMINDER_CHECK';
const MAX_CONCURRENT_ALARMS = 64;

// Helper to formatting local ISO string (YYYY-MM-DDTHH:mm:ss)
export function toLocalISOString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 19);
    return localISOTime;
}

export interface Reminder {
    id: string;
    fileUri: string; // Kept for compatibility, holds the ID
    fileName: string; // Kept for compatibility, holds the Title
    title?: string;
    reminderTime: string;
    recurrenceRule?: string; // e.g. "daily", "weekly", "10 minutes"
    alarm?: boolean;
    persistent?: number; // minutes
    content: string; // Full content for modal display
}

// Subscribe to Auth changes to trigger sync
onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
        console.log('[ReminderService] User authenticated, syncing reminders...');
        syncAllReminders();
    } else {
        console.log('[ReminderService] User logged out, clearing reminders...');
        useSettingsStore.getState().setCachedReminders([]);
    }
});

export const formatRecurrenceForReminder = (rule: any): string | undefined => {
    if (!rule || !rule.frequency || rule.frequency === 'none') return undefined;
    const freq = rule.frequency.toLowerCase();
    const interval = rule.interval || 1;

    if (interval === 1) {
        return freq; // 'daily', 'weekly', etc.
    }

    let unit = '';
    if (freq === 'daily') unit = 'days';
    else if (freq === 'weekly') unit = 'weeks';
    else if (freq === 'monthly') unit = 'months';
    else if (freq === 'yearly') unit = 'years';

    if (unit) return `${interval} ${unit}`;
    return undefined;
};

export function calculateNextRecurrence(currentDate: Date, rule: string): Date | null {
    const r = rule.toLowerCase().trim();
    const nextDate = new Date(currentDate);

    if (r === 'daily' || r === 'day') {
        nextDate.setDate(nextDate.getDate() + 1);
    } else if (r === 'weekly' || r === 'week') {
        nextDate.setDate(nextDate.getDate() + 7);
    } else if (r === 'monthly' || r === 'month') {
        nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (r === 'yearly' || r === 'year') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
        // Try parsing number + unit (e.g. "2 days", "30 minutes")
        const parts = r.split(' ');
        if (parts.length === 2) {
            const val = parseInt(parts[0]);
            const unit = parts[1];
            if (!isNaN(val)) {
                if (unit.startsWith('min')) nextDate.setMinutes(nextDate.getMinutes() + val);
                else if (unit.startsWith('hour')) nextDate.setHours(nextDate.getHours() + val);
                else if (unit.startsWith('day')) nextDate.setDate(nextDate.getDate() + val);
                else if (unit.startsWith('week')) nextDate.setDate(nextDate.getDate() + (val * 7));
                else if (unit.startsWith('month')) nextDate.setMonth(nextDate.getMonth() + val);
                else if (unit.startsWith('year')) nextDate.setFullYear(nextDate.getFullYear() + val);
            }
        } else {
            return null; // Invalid rule
        }
    }

    // Safety check - if date didn't change (e.g. invalid rule)
    if (nextDate.getTime() === currentDate.getTime()) return null;

    return nextDate;
}

export async function registerReminderTask() {
    try {
        const { backgroundSyncInterval } = useSettingsStore.getState();
        const interval = (backgroundSyncInterval || 15) * 60; // Convert minutes to seconds

        await BackgroundFetch.registerTaskAsync(REMINDER_TASK_NAME, {
            minimumInterval: interval,
            stopOnTerminate: false, // Continue even if app is closed
            startOnBoot: true, // Start on device boot
        });


        // Also run an immediate check when registering, to ensure we catch anything pending
        await TaskManager.getTaskOptionsAsync(REMINDER_TASK_NAME);

        // Ensure channel is set up
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('reminders-alarm', {
                name: 'Reminders (Alarm)',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 500, 500, 500],
                lightColor: '#FF231F7C',
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
                bypassDnd: true,
                audioAttributes: {
                    usage: Notifications.AndroidAudioUsage.ALARM,
                    contentType: Notifications.AndroidAudioContentType.SONIFICATION,
                }
            });
        }
    } catch (err) {
        console.error('[ReminderService] Task registration failed:', err);
    }
}

export async function unregisterReminderTask() {
    try {
        await BackgroundFetch.unregisterTaskAsync(REMINDER_TASK_NAME);
    } catch (err) {
        console.error('[ReminderService] Task unregistration failed:', err);
    }
}

export async function scanForReminders(): Promise<Reminder[]> {
    const user = firebaseAuth.currentUser;
    if (!user) {
        return [];
    }

    try {
        const remindersRef = collection(firebaseDb, 'users', user.uid, 'reminders');
        const snapshot = await getDocs(remindersRef);

        const reminders: Reminder[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                fileUri: doc.id, // Compatibility map
                fileName: data.title || 'Reminder', // Compatibility map
                title: data.title,
                reminderTime: data.reminderTime,
                recurrenceRule: data.recurrenceRule,
                alarm: data.alarm,
                persistent: data.persistent,
                content: data.content || ''
            };
        });

        return reminders;
    } catch (e) {
        console.error('[ReminderService] Failed to fetch reminders from Firestore:', e);
        return [];
    }
}

export async function updateReminder(
    fileUri: string, // This is now the Firestore ID
    newTime: string | null,
    recurrenceRule?: string,
    alarm?: boolean,
    persistent?: number,
    title?: string,
    bodyContent?: string
) {
    const user = firebaseAuth.currentUser;
    if (!user) return;

    try {
        const docRef = doc(firebaseDb, 'users', user.uid, 'reminders', fileUri);

        if (newTime === null) {
            // Delete reminder
            await deleteDoc(docRef);
        } else {
            // Update fields
            const updateData: any = {
                reminderTime: newTime
            };

            if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule || null;
            if (alarm !== undefined) updateData.alarm = alarm;
            if (persistent !== undefined) updateData.persistent = persistent || null;
            if (title !== undefined) updateData.title = title;
            if (bodyContent !== undefined) updateData.content = bodyContent;

            await updateDoc(docRef, updateData);
        }

        await syncAllReminders();
    } catch (e) {
        console.error('[ReminderService] Failed to update reminder:', e);
        throw e;
    }
}

export async function createStandaloneReminder(
    date: string,
    title?: string,
    recurrence?: string,
    alarm?: boolean,
    persistent?: number,
    additionalProps: Record<string, any> = {},
    tags: string[] = [],
    siblingFileUri?: string,
    bodyContent?: string
): Promise<{ uri: string, fileName: string } | null> {
    const user = firebaseAuth.currentUser;
    if (!user) {
        console.error('[ReminderService] Cannot create reminder: User not authenticated');
        return null;
    }

    try {
        const remindersRef = collection(firebaseDb, 'users', user.uid, 'reminders');

        const data = {
            title: title || 'Reminder',
            reminderTime: date,
            recurrenceRule: recurrence || null,
            alarm: !!alarm,
            persistent: persistent || null,
            content: bodyContent || 'Created via Reminders App.',
            tags: tags,
            ...additionalProps,
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(remindersRef, data);

        await syncAllReminders();

        return { uri: docRef.id, fileName: data.title };
    } catch (e) {
        console.error('[ReminderService] Failed to create reminder:', e);
        return null;
    }
}


// Helper to sync mood daily reminders
export async function syncMoodReminders() {
    try {
        if (!useMoodStore.persist.hasHydrated()) {
            await useMoodStore.persist.rehydrate();
        }

        const { moodReminderEnabled, moodReminderTime, moods } = useMoodStore.getState();

        // 1. Cancel legacy mood notifications (those without deterministic IDs)
        // We identify them by data.type === 'mood_daily'
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();

        // We will track which dates we DO schedule, to ensure we don't have duplicates
        const scheduledDates = new Set<string>();

        if (!moodReminderEnabled) {
            // Cancel ALL if disabled
            for (const notification of scheduled) {
                if (notification.content.data?.type === 'mood_daily') {
                    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                }
            }
            return;
        }

        // 2. Schedule for next 7 days if not already logged
        const now = dayjs();
        const reminderTime = dayjs(moodReminderTime); // This has the correct hour/minute

        for (let i = 0; i < 7; i++) {
            const targetDate = now.add(i, 'day')
                .hour(reminderTime.hour())
                .minute(reminderTime.minute())
                .second(0)
                .millisecond(0);

            const dateStr = targetDate.format('YYYY-MM-DD');
            const id = `mood-daily-${dateStr}`;

            // If time is in the past, skip
            if (targetDate.isBefore(now)) {
                continue;
            }

            // Check if mood exists
            if (moods[dateStr]) {
                // Already logged for this day. Ensure we cancel any existing reminder for this day.
                // We can try to cancel by ID
                await Notifications.cancelScheduledNotificationAsync(id);
                continue;
            }

            scheduledDates.add(id);

            // Schedule (updates if exists with same ID)
            await Notifications.scheduleNotificationAsync({
                identifier: id,
                content: {
                    title: "How was your day?",
                    body: "Take a moment to evaluate your day and add a note.",
                    data: { type: 'mood_daily', date: dateStr },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: targetDate.toDate(),
                    channelId: 'reminders-alarm',
                }
            });
        }

        // 3. Cleanup: Cancel any mood notification that is NOT in our new scheduled set
        for (const notification of scheduled) {
            if (notification.content.data?.type === 'mood_daily') {
                if (!scheduledDates.has(notification.identifier)) {
                    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                }
            }
        }

    } catch (e) {
        console.error('[MoodService] Sync failed:', e);
    }
}

// Helper to sync time range notifications
async function syncRangeNotifications() {
    try {
        if (!useEventTypesStore.persist.hasHydrated()) {
            await useEventTypesStore.persist.rehydrate();
        }

        const { ranges } = useEventTypesStore.getState();
        const enabledRanges = ranges.filter(r => r.isEnabled);
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const now = dayjs();
        const upcoming: { id: string, date: Date, title: string }[] = [];

        // Check today and tomorrow
        [0, 1].forEach(offset => {
            const targetDate = now.add(offset, 'day');
            const dayOfWeek = targetDate.day(); // 0-6

            enabledRanges.forEach(range => {
                if (range.days.includes(dayOfWeek)) {
                    const start = targetDate
                        .hour(range.start.hour)
                        .minute(range.start.minute)
                        .second(0)
                        .millisecond(0);

                    // Only schedule if in future
                    if (start.isAfter(now)) {
                        upcoming.push({
                            id: `range-${range.id}-${start.format('YYYYMMDDHHmm')}`, // Deterministic ID part
                            date: start.toDate(),
                            title: range.title
                        });
                    }
                }
            });
        });

        const upcomingIds = new Set(upcoming.map(u => u.id));

        // 1. Clean up stale range notifications
        for (const notification of scheduled) {
            const data = notification.content.data as Record<string, any>;
            if (data?.type === 'range_start') {
                if (!upcomingIds.has(notification.identifier)) {
                    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                }
            }
        }

        // 2. Schedule new ones (or update existing)
        for (const item of upcoming) {
            await Notifications.scheduleNotificationAsync({
                identifier: item.id,
                content: {
                    title: item.title,
                    body: `Starting now`,
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    data: {
                        type: 'range_start',
                        rangeInstanceId: item.id,
                        triggerDate: item.date.toISOString()
                    }
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: item.date,
                    channelId: 'reminders-alarm'
                }
            });
        }

    } catch (e) {
        console.error('[RangeService] Sync failed:', e);
    }
}

export async function syncAllReminders() {
    try {
        // Ensure settings are hydrated (critical for background tasks)
        if (!useSettingsStore.persist.hasHydrated()) {
            await useSettingsStore.persist.rehydrate();
        }

        // Sync Time Ranges
        await syncRangeNotifications();

        // Sync Mood Reminders
        await syncMoodReminders();

        const reminders = await scanForReminders();

        useSettingsStore.getState().setCachedReminders(reminders);

        await manageNotifications(reminders);

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('[DEBUG_REMINDER] Sync failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
}

TaskManager.defineTask(REMINDER_TASK_NAME, async () => {
    return await syncAllReminders();
});

async function manageNotifications(activeReminders: Reminder[]) {
    // 1. Get all currently scheduled notifications
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    // 1.5. Check for missed/ignored notifications and resend if enabled
    const presented = await Notifications.getPresentedNotificationsAsync();
    const now = Date.now();

    for (const notification of presented) {
        const fileUri = notification.request.content.data?.fileUri as string; // Will be Firestore ID
        if (!fileUri) continue;

        // Try to find the reminder to check its persistent setting
        let reminderData = activeReminders.find(r => r.fileUri === fileUri || r.id === fileUri);

        let intervalMs = -1;

        if (reminderData && reminderData.persistent) {
            intervalMs = reminderData.persistent * 60 * 1000;
        }

        if (intervalMs > 0) {
            const triggerTime = notification.date;
            if (now - triggerTime > intervalMs) {
                // It's stale and ignored. Resend!
                await Notifications.dismissNotificationAsync(notification.request.identifier);

                // Re-fetch reminder data if we didn't have it (fallback logic)
                if (!reminderData) {
                    // Fallback attempt: Fetch by ID
                    try {
                        const user = firebaseAuth.currentUser;
                        if (user) {
                            const docRef = doc(firebaseDb, 'users', user.uid, 'reminders', fileUri);
                            // We don't have async fetch here easily without complicating logic.
                            // But usually activeReminders has latest.
                        }
                    } catch (e) {
                        // ignore
                    }
                    if (!reminderData) {
                        reminderData = notification.request.content.data?.reminder as Reminder;
                    }
                }

                if (reminderData) {
                    await scheduleNotification(reminderData, true);
                }
            }
        }
    }

    // 2. Cleanup stale notifications
    const activeReminderIds = new Set<string>();

    // Map active reminders to their expected IDs
    const expectedIds = new Map<string, string>(); // id -> deterministic Notification ID
    const expectedNativeIds = new Map<string, number>(); // id -> deterministic Alarm ID

    activeReminders.forEach(r => {
        // Notification ID (string) depends on ID AND time
        const id = `reminder-${getHash(r.id)}-${getHash(r.reminderTime)}`;
        expectedIds.set(r.id, id);

        // Native Alarm ID (int) depends ONLY on ID
        const nativeId = Math.abs(getHash(r.id)) % 2147483647;
        expectedNativeIds.set(r.id, nativeId);

        activeReminderIds.add(id);
    });

    for (const notification of scheduled) {
        const fileUri = (notification.content.data as any)?.fileUri; // Firestore ID

        if (!fileUri) continue;

        if (!activeReminderIds.has(notification.identifier)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);

            const nativeId = expectedNativeIds.get(fileUri) || (Math.abs(getHash(fileUri)) % 2147483647);
            await stopNativeAlarm(nativeId);
        }
    }

    // 3. Schedule missing notifications
    const nowTime = new Date();

    const sortedReminders = [...activeReminders].sort((a, b) =>
        new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime()
    );

    let scheduledCount = 0;

    for (const reminder of sortedReminders) {
        const remDate = new Date(reminder.reminderTime);
        const expectedId = expectedIds.get(reminder.id);
        const expectedNativeId = expectedNativeIds.get(reminder.id);

        if (remDate <= nowTime) {
            // Check if it was recent (within 15 mins) and NOT already notified
            const diff = nowTime.getTime() - remDate.getTime();
            if (diff < 15 * 60 * 1000) {
                // It's recent.
                if (reminder.recurrenceRule) {
                    // It's overdue and repeating. Advance it!
                    const nextDate = calculateNextRecurrence(remDate, reminder.recurrenceRule);
                    if (nextDate && nextDate > nowTime) {
                        await updateReminder(reminder.id, nextDate.toISOString(), reminder.recurrenceRule);
                        continue;
                    }
                }
                continue;
            }
        }

        // Schedule it (or update if exists)
        if (remDate > nowTime) {
            if (scheduledCount >= MAX_CONCURRENT_ALARMS) {
                break;
            }

            await scheduleNotification(reminder, false, expectedId, expectedNativeId);
            scheduledCount++;
        }
    }
}

async function scheduleNotification(reminder: Reminder, immediate = false, identifier?: string, nativeId?: number) {
    if (reminder.alarm) {
        const timestamp = immediate ? Date.now() + 1000 : new Date(reminder.reminderTime).getTime();
        const activeNativeId = nativeId || (Math.abs(getHash(reminder.id)) % 2147483647);

        const success = await scheduleNativeAlarm(
            reminder.title || reminder.fileName || 'Reminder',
            reminder.content || "Alarm Reminder",
            timestamp,
            activeNativeId
        );
        if (success) {
            return;
        }
    }

    const id = await Notifications.scheduleNotificationAsync({
        identifier: identifier,
        content: {
            title: "🔔 Reminder",
            body: `${reminder.title || reminder.fileName}: ${reminder.content}`,
            data: { fileUri: reminder.id, reminderTime: reminder.reminderTime, reminder: reminder },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 500, 500, 500],
            color: '#FF231F7C',
        },
        trigger: immediate
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 1,
                channelId: 'reminders-alarm',
                repeats: false
            }
            : {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(reminder.reminderTime),
                channelId: 'reminders-alarm'
            },
    });
}
