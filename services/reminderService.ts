import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/settings';

const REMINDER_TASK_NAME = 'BACKGROUND_REMINDER_CHECK';
const REMINDER_PROPERTY_KEY = 'reminder_datetime';

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
        await BackgroundFetch.registerTaskAsync(REMINDER_TASK_NAME, {
            minimumInterval: 15 * 60, // 15 minutes
            stopOnTerminate: false, // Continue even if app is closed
            startOnBoot: true, // Start on device boot
        });
        console.log('[ReminderService] Task registered');
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
    content: string; // Brief content for notification
}

export async function scanForReminders(): Promise<Reminder[]> {
    const { vaultUri } = useSettingsStore.getState();
    if (!vaultUri) {
        console.log('[ReminderService] No vault URI set');
        return [];
    }

    const reminders: Reminder[] = [];

    try {
        // Recursive function to scan directories
        // Note: For deep vaults this might be slow, but for now we'll do a basic scan
        // Limitation: SAF permissions might not extend recursively automatically or listing might be shallow
        // We'll assume a relatively flat structure or just scan known folders if we could.
        // But `readDirectoryAsync` on SAF URI works.

        await scanDirectory(vaultUri, reminders);

    } catch (e) {
        console.error('[ReminderService] Scan failed:', e);
    }

    return reminders;
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

                reminders.push({
                    fileUri,
                    fileName,
                    reminderTime: cleanTime,
                    content: content.replace(/^---[\s\S]*?---\n/, '').trim().substring(0, 100) // snippet
                });
            }
        }
    } catch (e) {
        // Error reading file
    }
}


TaskManager.defineTask(REMINDER_TASK_NAME, async () => {
    try {
        console.log('[ReminderService] Background scan starting...');
        const reminders = await scanForReminders();

        const now = new Date();

        for (const reminder of reminders) {
            const remDate = new Date(reminder.reminderTime);

            // If reminder is in the past (within a reasonable window, e.g. last 15 mins) or future
            // Actually, we want to schedule a notification if it's in the future.
            // If it's in the past and we haven't shown it? That's harder to track without local state.
            // "At the time it shows reminder like alarm"

            if (remDate > now) {
                // Schedule it
                await scheduleNotificationIfNotExists(reminder);
            } else {
                 // Check if it was recent (e.g. we missed it by a few minutes due to background fetch delay)
                 const diff = now.getTime() - remDate.getTime();
                 if (diff < 15 * 60 * 1000) { // 15 mins
                     await scheduleNotificationIfNotExists(reminder, true); // Fire immediately
                 }
            }
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('[ReminderService] Task failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

async function scheduleNotificationIfNotExists(reminder: Reminder, immediate = false) {
    // Check if already scheduled
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const identifier = `reminder-${reminder.fileUri}`; // Unique ID based on file

    const exists = scheduled.find(n => n.identifier === identifier);

    if (exists) {
        // You might want to update it if time changed?
        // For now, assume if exists, it's handled.
        return;
    }

    // We can't set identifier easily in `scheduleNotificationAsync` in older versions?
    // Actually we can pass identifier in some libraries, but expo-notifications generates one usually.
    // Wait, we can't force an identifier on creation easily in Expo managed workflow without a category or similar?
    // Actually `scheduleNotificationAsync` returns the ID. We should store it?
    // Or we rely on searching `content.data`.

    const isAlreadyScheduled = scheduled.some(n => n.content.data?.fileUri === reminder.fileUri && n.content.data?.reminderTime === reminder.reminderTime);

    if (isAlreadyScheduled) return;

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title: "🔔 Reminder",
            body: `${reminder.fileName}: ${reminder.content}`,
            data: { fileUri: reminder.fileUri, reminderTime: reminder.reminderTime },
            sound: true,
        },
        trigger: immediate ? null : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(reminder.reminderTime) },
    });
    console.log(`[ReminderService] Scheduled notification ${id} for ${reminder.fileName}`);
}
