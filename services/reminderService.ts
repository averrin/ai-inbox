import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/settings';
import { Platform } from 'react-native';

const REMINDER_TASK_NAME = 'BACKGROUND_REMINDER_CHECK';
const REMINDER_PROPERTY_KEY = 'reminder_datetime';
const RECURRENT_PROPERTY_KEY = 'reminder_recurrent';

// Helper to clean frontmatter key/value
function parseFrontmatter(content: string): Record<string, string> {
    const fm: Record<string, string> = {};
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return fm;

    const lines = match[1].split('\n');
    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            fm[key] = value;
        }
    }
    return fm;
}

// Check if string is a valid ISO date or date-time
function isValidDate(dateString: string): boolean {
    const d = new Date(dateString);
    return !isNaN(d.getTime());
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
    content: string; // Full content for modal display
}

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

// Update a reminder time or delete it (if newTime is null)
// Update a reminder time or delete it (if newTime is null)
// Also triggers sync if needed
export async function updateReminder(fileUri: string, newTime: string | null, recurrenceRule?: string) {
    try {
        const content = await StorageAccessFramework.readAsStringAsync(fileUri);
        let newContent = content;

        if (newTime) {
            // Update or add
            if (content.match(new RegExp(`${REMINDER_PROPERTY_KEY}:.*`))) {
                newContent = content.replace(
                    new RegExp(`${REMINDER_PROPERTY_KEY}:.*`),
                    `${REMINDER_PROPERTY_KEY}: ${newTime}`
                );
            } else {
                // Insert into frontmatter if exists
                if (content.startsWith('---')) {
                    const endOfFM = content.indexOf('\n---', 3);
                    if (endOfFM !== -1) {
                        newContent = content.slice(0, endOfFM) + `\n${REMINDER_PROPERTY_KEY}: ${newTime}` + content.slice(endOfFM);
                    }
                }
            }

            // Update or add recurrence rule if provided (even empty string to remove)
            if (recurrenceRule !== undefined) {
                if (newContent.match(new RegExp(`${RECURRENT_PROPERTY_KEY}:.*`))) {
                    if (recurrenceRule) {
                        newContent = newContent.replace(
                            new RegExp(`${RECURRENT_PROPERTY_KEY}:.*`),
                            `${RECURRENT_PROPERTY_KEY}: ${recurrenceRule}`
                        );
                    } else {
                        // Remove line
                        newContent = newContent.replace(new RegExp(`^${RECURRENT_PROPERTY_KEY}:.*\\n?`, 'm'), '');
                    }
                } else if (recurrenceRule) {
                    // Insert after reminder time (which we know exists now)
                    newContent = newContent.replace(
                        new RegExp(`(${REMINDER_PROPERTY_KEY}:.*)`),
                        `$1\n${RECURRENT_PROPERTY_KEY}: ${recurrenceRule}`
                    );
                }
            }
        } else {
            // Delete (Remove the line)
            newContent = content.replace(new RegExp(`^${REMINDER_PROPERTY_KEY}:.*\\n?`, 'm'), '');
        }

        if (newContent !== content) {
            await StorageAccessFramework.writeAsStringAsync(fileUri, newContent);

            // Trigger global sync to update notifications
            await syncAllReminders();
        }
    } catch (e) {
        console.error('[ReminderService] Failed to update reminder:', e);
        throw e;
    }
}

async function scanDirectory(uri: string, reminders: Reminder[]) {
    try {
        const files = await StorageAccessFramework.readDirectoryAsync(uri);

        for (const fileUri of files) {
            const decoded = decodeURIComponent(fileUri);

            // If it ends in .md, check it
            if (decoded.endsWith('.md')) {
                await checkFileForReminder(fileUri, reminders);
            }
            // If it has no extension, it *might* be a folder.
            // SAF URIs for folders usually don't have extensions.
            // However, simply calling readDirectoryAsync on a file will fail, so we try-catch it.
            // A safer recursion check:
            else if (!decoded.split('/').pop()?.includes('.')) {
                // Try to recurse
                try {
                    await scanDirectory(fileUri, reminders);
                } catch (ignored) {
                    // Not a directory or permission denied
                }
            }
        }
    } catch (e) {
        // Ignore errors (e.g. permission or not a folder)
    }
}

async function checkFileForReminder(fileUri: string, reminders: Reminder[]) {
    try {
        const content = await StorageAccessFramework.readAsStringAsync(fileUri);
        const fm = parseFrontmatter(content);

        if (fm[REMINDER_PROPERTY_KEY]) {
            const timeStr = fm[REMINDER_PROPERTY_KEY];
            // Remove quotes if present
            const cleanTime = timeStr.replace(/^["']|["']$/g, '');

            if (isValidDate(cleanTime)) {
                // Get filename from URI roughly
                const decoded = decodeURIComponent(fileUri);
                const parts = decoded.split('/');
                const fileName = parts[parts.length - 1];

                const recurrenceRule = fm[RECURRENT_PROPERTY_KEY] ? fm[RECURRENT_PROPERTY_KEY].replace(/^["']|["']$/g, '') : undefined;

                reminders.push({
                    fileUri,
                    fileName,
                    reminderTime: cleanTime,
                    recurrenceRule,
                    content: content.replace(/^---[\s\S]*?---\n/, '').trim() // Full content without frontmatter
                });
            }
        }
    } catch (e) {
        // Error reading file
    }
}


// Exported function to be called from background task OR foreground (e.g. after adding a file)
export async function syncAllReminders() {
    try {
        const reminders = await scanForReminders();

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

    // 2. Identify stale notifications (those that don't match any active reminder or have changed time)
    for (const notification of scheduled) {
        const fileUri = notification.content.data?.fileUri;
        const reminderTime = notification.content.data?.reminderTime;

        if (!fileUri) continue; // Not one of ours or malformed

        // Find matching active reminder
        const match = activeReminders.find(r => r.fileUri === fileUri);

        if (!match) {
            // Reminder no longer exists (deleted)
            // Reminder no longer exists (deleted)
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        } else if (match.reminderTime !== reminderTime) {
            // Time has changed
            // Time has changed
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    }

    // 3. Schedule missing notifications
    const now = new Date();
    for (const reminder of activeReminders) {
        const remDate = new Date(reminder.reminderTime);

        if (remDate <= now) {
            // Check if it was recent (within 15 mins) and NOT already notified
            // This is tricky without local state. For now, we rely on duplicate check below.
            // But if it's past due, we might just fire it if it's recent.
            const diff = now.getTime() - remDate.getTime();
            if (diff < 15 * 60 * 1000) {
                // It's recent.
                // We will NOT fire it immediately to avoid duplicates in loop.
                // The user likely missed it or it was already handled.
                // If we want to catch up, we need state tracking which we lack.
                // If we want to catch up, we need state tracking which we lack.
                continue;
            }
        }

        // Check if a valid notification exists for this Exact time
        const isScheduled = scheduled.some(n =>
            n.content.data?.fileUri === reminder.fileUri &&
            n.content.data?.reminderTime === reminder.reminderTime
        );

        if (!isScheduled) {
            // Schedule it
            if (remDate > now) {
                console.log(`[DEBUG_REMINDER] Scheduling future reminder: ${reminder.fileName}`);
                await scheduleNotification(reminder);
            } else {
                // Recent past - Do NOT fire immediate prevents duplicate loops
            }
        } else {
            // Already scheduled correctly
        }
    }
}

async function scheduleNotification(reminder: Reminder, immediate = false) {
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
                date: new Date(reminder.reminderTime),
                channelId: 'reminders-alarm'
            },
    });
    console.log(`[DEBUG_REMINDER] Scheduled notification ${id} for ${reminder.fileName} at ${reminder.reminderTime}`);
}
