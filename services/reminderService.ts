import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/settings';
import { Platform } from 'react-native';
import { scheduleNativeAlarm, stopNativeAlarm } from './alarmModule';
import dayjs from 'dayjs';
import { parseFrontmatter, updateFrontmatter } from '../utils/markdown';

const REMINDER_TASK_NAME = 'BACKGROUND_REMINDER_CHECK';
const REMINDER_PROPERTY_KEY = 'reminder_datetime';
const RECURRENT_PROPERTY_KEY = 'reminder_recurrent';
const ALARM_PROPERTY_KEY = 'reminder_alarm';
const PERSISTENT_PROPERTY_KEY = 'reminder_persistent';

// Helper to formatting local ISO string (YYYY-MM-DDTHH:mm:ss)
export function toLocalISOString(date: Date): string {
    return dayjs(date).format('YYYY-MM-DDTHH:mm:ss');
}

// Helper to generate unique filename
export async function getUniqueFilename(folderUri: string, baseName: string): Promise<string> {
    const { checkFileExists } = await import('../utils/saf');
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9\s-_]/g, '-').trim();

    let fileName = `${sanitizedName}.md`;
    let counter = 1;

    while (await checkFileExists(folderUri, fileName)) {
        fileName = `${sanitizedName} (${counter}).md`;
        counter++;
    }

    return fileName;
}

// Check if string is a valid ISO date or date-time
function isValidDate(dateString: string): boolean {
    return dayjs(dateString).isValid();
}

export async function registerReminderTask() {
    try {
        const { backgroundSyncInterval } = useSettingsStore.getState();
        const interval = (backgroundSyncInterval || 15) * 60; // Convert minutes to seconds

        await BackgroundFetch.registerTaskAsync(REMINDER_TASK_NAME, {
            minimumInterval: interval,
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
        console.log('[ReminderService] Task unregistered');
    } catch (err) {
        console.error('[ReminderService] Task unregistration failed:', err);
    }
}

export interface Reminder {
    fileUri: string;
    fileName: string;
    reminderTime: string;
    recurrenceRule?: string; // e.g. "daily", "weekly", "10 minutes"
    alarm?: boolean;
    persistent?: number; // minutes
    content: string; // Full content for modal display
}

export function calculateNextRecurrence(currentDate: Date, rule: string): Date | null {
    const r = rule.toLowerCase().trim();
    let nextDate = dayjs(currentDate);

    if (r === 'daily' || r === 'day') {
        nextDate = nextDate.add(1, 'day');
    } else if (r === 'weekly' || r === 'week') {
        nextDate = nextDate.add(1, 'week');
    } else if (r === 'monthly' || r === 'month') {
        nextDate = nextDate.add(1, 'month');
    } else if (r === 'yearly' || r === 'year') {
        nextDate = nextDate.add(1, 'year');
    } else {
        // Try parsing number + unit
        const parts = r.split(' ');
        if (parts.length === 2) {
            const val = parseInt(parts[0]);
            const unit = parts[1];
             if (!isNaN(val)) {
                let unitKey: dayjs.ManipulateType | undefined;
                if (unit.startsWith('min')) unitKey = 'minute';
                else if (unit.startsWith('hour')) unitKey = 'hour';
                else if (unit.startsWith('day')) unitKey = 'day';
                else if (unit.startsWith('week')) unitKey = 'week';
                else if (unit.startsWith('month')) unitKey = 'month';
                else if (unit.startsWith('year')) unitKey = 'year';

                if (unitKey) {
                    nextDate = nextDate.add(val, unitKey);
                } else {
                    return null;
                }
            } else {
                return null;
            }
        } else {
            return null; // Invalid rule
        }
    }

    if (nextDate.isSame(dayjs(currentDate))) return null;
    return nextDate.toDate();
}

export async function scanForReminders(): Promise<Reminder[]> {
    const { vaultUri, remindersScanFolder } = useSettingsStore.getState();
    if (!vaultUri) {
        console.log('[ReminderService] No vault URI set');
        return [];
    }

    const reminders: Reminder[] = [];

    try {
        let targetUri = vaultUri;

        // If a scan folder is configured, verify it exists and use it as root
        if (remindersScanFolder && remindersScanFolder.trim()) {
            const { checkDirectoryExists } = await import('../utils/saf');
            const folderUri = await checkDirectoryExists(vaultUri, remindersScanFolder.trim());
            if (folderUri) {
                targetUri = folderUri;
            } else {
                console.warn('[ReminderService] Configured scan folder not found:', remindersScanFolder);
            }
        }

        await scanDirectory(targetUri, reminders);

    } catch (e) {
        console.error('[ReminderService] Scan failed:', e);
    }

    return reminders;
}

export async function updateReminder(
    fileUri: string,
    newTime: string | null,
    recurrenceRule?: string,
    alarm?: boolean,
    persistent?: number
) {
    try {
        const content = await StorageAccessFramework.readAsStringAsync(fileUri);
        const { frontmatter } = parseFrontmatter(content);

        // Check for existing alarm to cancel it if time changes or alarm is disabled
        if (frontmatter[ALARM_PROPERTY_KEY] === 'true' && frontmatter[REMINDER_PROPERTY_KEY]) {
            const oldTimeStr = String(frontmatter[REMINDER_PROPERTY_KEY]).replace(/^["']|["']$/g, '');
            const oldDate = dayjs(oldTimeStr);
            if (oldDate.isValid()) {
                console.log(`[ReminderService] Cancelling old native alarm for ${oldDate.toISOString()}`);
                await stopNativeAlarm(oldDate.valueOf());
            }
        }

        const updates: Record<string, string | null> = {};

        if (newTime) {
            updates[REMINDER_PROPERTY_KEY] = newTime;

            if (recurrenceRule !== undefined) {
                updates[RECURRENT_PROPERTY_KEY] = recurrenceRule || null;
            }

            if (alarm !== undefined) {
                 // If alarm is true, write 'true'. If false, remove it (pass null)
                updates[ALARM_PROPERTY_KEY] = alarm ? 'true' : null;
            }

            if (persistent !== undefined) {
                updates[PERSISTENT_PROPERTY_KEY] = persistent ? String(persistent) : null;
            }
        } else {
            // Delete reminder related keys
            updates[REMINDER_PROPERTY_KEY] = null;
        }

        const newContent = updateFrontmatter(content, updates);

        if (newContent !== content) {
            await StorageAccessFramework.writeAsStringAsync(fileUri, newContent);

            // Trigger global sync to update notifications
            await syncAllReminders();
        }
    } catch (e: any) {
        console.warn('[ReminderService] Failed to update reminder file:', e);

        // If file not found/readable, we should still trigger a sync
        if (e.message?.includes('not readable') || e.message?.includes('does not exist')) {
            console.log('[ReminderService] File missing, triggering cleanup sync...');
            await syncAllReminders();
            return; // Treated as success (cleanup)
        }
        throw e;
    }
}

async function scanDirectory(uri: string, reminders: Reminder[]) {
    try {
        const files = await StorageAccessFramework.readDirectoryAsync(uri);

        for (const fileUri of files) {
            const decoded = decodeURIComponent(fileUri);

            if (decoded.endsWith('.md')) {
                await checkFileForReminder(fileUri, reminders);
            }
            else if (!decoded.split('/').pop()?.includes('.')) {
                try {
                    await scanDirectory(fileUri, reminders);
                } catch (ignored) {
                }
            }
        }
    } catch (e) {
    }
}

async function checkFileForReminder(fileUri: string, reminders: Reminder[]) {
    try {
        const content = await StorageAccessFramework.readAsStringAsync(fileUri);
        const { frontmatter, content: body } = parseFrontmatter(content);

        if (frontmatter[REMINDER_PROPERTY_KEY]) {
            const timeStr = String(frontmatter[REMINDER_PROPERTY_KEY]);
            const cleanTime = timeStr.replace(/^["']|["']$/g, '');

            if (isValidDate(cleanTime)) {
                const decoded = decodeURIComponent(fileUri);
                const parts = decoded.split('/');
                const fileName = parts[parts.length - 1];

                const recurrenceRule = frontmatter[RECURRENT_PROPERTY_KEY] ? String(frontmatter[RECURRENT_PROPERTY_KEY]).replace(/^["']|["']$/g, '') : undefined;

                const alarmStr = String(frontmatter[ALARM_PROPERTY_KEY]);
                const alarm = alarmStr === 'true';

                const persistentStr = frontmatter[PERSISTENT_PROPERTY_KEY];
                const persistent = persistentStr ? parseInt(String(persistentStr).replace(/^["']|["']$/g, ''), 10) : undefined;

                reminders.push({
                    fileUri,
                    fileName,
                    reminderTime: cleanTime,
                    recurrenceRule,
                    alarm,
                    persistent: isNaN(persistent as number) ? undefined : persistent,
                    content: body // Full content without frontmatter
                });
            }
        }
    } catch (e) {
        // Error reading file
    }
}


export async function syncAllReminders() {
    try {
        // Ensure settings are hydrated (critical for background tasks)
        if (!useSettingsStore.persist.hasHydrated()) {
            await useSettingsStore.persist.rehydrate();
        }

        const reminders = await scanForReminders();

        await manageNotifications(reminders);

        return BackgroundFetch.BackgroundTaskResult.Success;
    } catch (error) {
        console.error('[DEBUG_REMINDER] Sync failed:', error);
        return BackgroundFetch.BackgroundTaskResult.Failed;
    }
}

TaskManager.defineTask(REMINDER_TASK_NAME, async () => {
    return await syncAllReminders();
});

async function manageNotifications(activeReminders: Reminder[]) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const presented = await Notifications.getPresentedNotificationsAsync();
    const now = dayjs();

    for (const notification of presented) {
        const fileUri = notification.request.content.data?.fileUri as string;
        if (!fileUri) continue;

        let reminderData = activeReminders.find(r => r.fileUri === fileUri);
        let intervalMs = -1;

        if (reminderData && reminderData.persistent) {
            intervalMs = reminderData.persistent * 60 * 1000;
        }

        if (intervalMs > 0) {
            const triggerTime = dayjs(notification.date);
            if (now.diff(triggerTime) > intervalMs) {
                console.log(`[DEBUG_REMINDER] Resending persistent/missed notification for ${notification.request.content.title}`);

                await Notifications.dismissNotificationAsync(notification.request.identifier);

                if (!reminderData) {
                    try {
                        const recovered: Reminder[] = [];
                        await checkFileForReminder(fileUri, recovered);
                        if (recovered.length > 0) {
                            reminderData = recovered[0];
                        }
                    } catch (e) {
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

    for (const notification of scheduled) {
        const fileUri = notification.content.data?.fileUri;
        const reminderTime = notification.content.data?.reminderTime;

        if (!fileUri) continue;

        const match = activeReminders.find(r => r.fileUri === fileUri);

        if (!match) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        } else if (match.reminderTime !== reminderTime) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }

    const nowTime = now.toDate();
    for (const reminder of activeReminders) {
        const remDate = dayjs(reminder.reminderTime);

        if (remDate.isBefore(now)) {
            const diff = now.diff(remDate, 'minute');
            if (diff < 15) {
                if (reminder.recurrenceRule) {
                    const nextDate = calculateNextRecurrence(remDate.toDate(), reminder.recurrenceRule);
                    if (nextDate && dayjs(nextDate).isAfter(now)) {
                        console.log(`[ReminderService] Auto-advancing overdue recurring reminder: ${reminder.fileName} to ${dayjs(nextDate).toISOString()}`);

                        await updateReminder(reminder.fileUri, dayjs(nextDate).toISOString(), reminder.recurrenceRule);
                        continue;
                    }
                }
                continue;
            }
        }

        const isScheduled = scheduled.some(n =>
            n.content.data?.fileUri === reminder.fileUri &&
            n.content.data?.reminderTime === reminder.reminderTime
        );

        if (!isScheduled) {
            if (remDate.isAfter(now)) {
                console.log(`[DEBUG_REMINDER] Scheduling future reminder: ${reminder.fileName}`);
                await scheduleNotification(reminder);
            }
        }
    }
}

async function scheduleNotification(reminder: Reminder, immediate = false) {
    if (reminder.alarm) {
        const timestamp = immediate ? Date.now() + 1000 : dayjs(reminder.reminderTime).valueOf();
        const success = await scheduleNativeAlarm(
            reminder.fileName.replace('.md', ''),
            reminder.content || "Alarm Reminder",
            timestamp
        );
        if (success) {
            console.log(`[DEBUG_REMINDER] Scheduled NATIVE alarm for ${reminder.fileName}`);
            return;
        }
    }

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: "🔔 Reminder",
            body: `${reminder.fileName}: ${reminder.content}`,
            data: { fileUri: reminder.fileUri, reminderTime: reminder.reminderTime, reminder: reminder },
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
                date: dayjs(reminder.reminderTime).toDate(),
                channelId: 'reminders-alarm'
            },
    });
    console.log(`[DEBUG_REMINDER] Scheduled notification ${id} for ${reminder.fileName} at ${reminder.reminderTime}`);
}
