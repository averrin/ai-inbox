import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { useMoodStore } from '../store/moodStore';
import { Platform } from 'react-native';
import { scheduleNativeAlarm, stopNativeAlarm, cancelAllNativeAlarms } from './alarmModule';
import dayjs from 'dayjs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getParentFolderUri } from '../utils/saf';

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
export const REMINDER_PROPERTY_KEY = 'reminder_datetime';
export const RECURRENT_PROPERTY_KEY = 'reminder_recurrent';
export const ALARM_PROPERTY_KEY = 'reminder_alarm';
export const PERSISTENT_PROPERTY_KEY = 'reminder_persistent';
export const TITLE_PROPERTY_KEY = 'title';

const MAX_CONCURRENT_ALARMS = 64;

// Helper to formatting local ISO string (YYYY-MM-DDTHH:mm:ss)
export function toLocalISOString(date: Date): string {
    const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 19);
    return localISOTime;
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
    } catch (err) {
        console.error('[ReminderService] Task unregistration failed:', err);
    }
}

export interface Reminder {
    fileUri: string;
    fileName: string;
    title?: string;
    reminderTime: string;
    recurrenceRule?: string; // e.g. "daily", "weekly", "10 minutes"
    alarm?: boolean;
    persistent?: number; // minutes
    content: string; // Full content for modal display
}

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

export async function scanForReminders(): Promise<Reminder[]> {
    const { vaultUri, remindersScanFolder } = useSettingsStore.getState();
    if (!vaultUri) {
        return [];
    }

    const reminders: Reminder[] = [];
    let fileCount = 0;
    const MAX_FILES_TO_SCAN = 1000; // Safeguard against massive vaults

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

        await scanDirectory(targetUri, reminders, (count) => {
            fileCount += count;
            return fileCount < MAX_FILES_TO_SCAN;
        });

        if (fileCount >= MAX_FILES_TO_SCAN) {
            console.warn(`[ReminderService] Scan limit reached (${MAX_FILES_TO_SCAN} files). Some reminders may be missing.`);
        }

        // Emergency Cleanup: Wipe all native alarms ONCE if we haven't yet
        // This clears the thousands of duplicate alarms caused by the previous bug.
        const cleanupDone = await AsyncStorage.getItem('emergency_alarm_cleanup_v1');
        if (!cleanupDone) {
            await cancelAllNativeAlarms();
            await AsyncStorage.setItem('emergency_alarm_cleanup_v1', 'true');
        }

    } catch (e) {
        console.error('[ReminderService] Scan failed:', e);
    }

    return reminders;
}

// Update a reminder time or delete it (if newTime is null)
// Update a reminder time or delete it (if newTime is null)
// Also triggers sync if needed
// Update a reminder time or delete it (if newTime is null)
// Also triggers sync if needed
export async function updateReminder(
    fileUri: string,
    newTime: string | null,
    recurrenceRule?: string,
    alarm?: boolean,
    persistent?: number,
    title?: string
) {
    try {
        const content = await StorageAccessFramework.readAsStringAsync(fileUri);

        // Check for existing alarm to cancel it if time changes or alarm is disabled
        const oldFm = parseFrontmatter(content);
        if (oldFm[ALARM_PROPERTY_KEY] === 'true' && oldFm[REMINDER_PROPERTY_KEY]) {
            const oldTimeStr = oldFm[REMINDER_PROPERTY_KEY].replace(/^["']|["']$/g, '');
            const oldDate = new Date(oldTimeStr);
            if (!isNaN(oldDate.getTime())) {
                await stopNativeAlarm(oldDate.getTime());
            }
        }

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

            // Update recurrence
            if (recurrenceRule !== undefined) {
                if (newContent.match(new RegExp(`${RECURRENT_PROPERTY_KEY}:.*`))) {
                    if (recurrenceRule) {
                        newContent = newContent.replace(
                            new RegExp(`${RECURRENT_PROPERTY_KEY}:.*`),
                            `${RECURRENT_PROPERTY_KEY}: ${recurrenceRule}`
                        );
                    } else {
                        newContent = newContent.replace(new RegExp(`^${RECURRENT_PROPERTY_KEY}:.*\\n?`, 'm'), '');
                    }
                } else if (recurrenceRule) {
                    newContent = newContent.replace(
                        new RegExp(`(${REMINDER_PROPERTY_KEY}:.*)`),
                        `$1\n${RECURRENT_PROPERTY_KEY}: ${recurrenceRule}`
                    );
                }
            }

            // Update Alarm
            if (alarm !== undefined) {
                const alarmVal = alarm ? 'true' : 'false';
                // If false, we might prefer to remove the line to keep it clean, but explicit false is okay too.
                // Let's remove if false for cleaner files, or explicit. 
                // Spec implies boolean. Let's write 'true' if true, remove if false/undefined?
                // Actually if I pass 'false', I probably want to disable it.

                if (newContent.match(new RegExp(`${ALARM_PROPERTY_KEY}:.*`))) {
                    if (alarm) {
                        newContent = newContent.replace(
                            new RegExp(`${ALARM_PROPERTY_KEY}:.*`),
                            `${ALARM_PROPERTY_KEY}: ${alarmVal}`
                        );
                    } else {
                        // Remove if false (default)
                        newContent = newContent.replace(new RegExp(`^${ALARM_PROPERTY_KEY}:.*\\n?`, 'm'), '');
                    }
                } else if (alarm) {
                    // Insert
                    newContent = newContent.replace(
                        new RegExp(`(${REMINDER_PROPERTY_KEY}:.*)`),
                        `$1\n${ALARM_PROPERTY_KEY}: ${alarmVal}`
                    );
                }
            }

            // Update Persistent
            if (persistent !== undefined) {
                if (newContent.match(new RegExp(`${PERSISTENT_PROPERTY_KEY}:.*`))) {
                    if (persistent) {
                        newContent = newContent.replace(
                            new RegExp(`${PERSISTENT_PROPERTY_KEY}:.*`),
                            `${PERSISTENT_PROPERTY_KEY}: ${persistent}`
                        );
                    } else {
                        newContent = newContent.replace(new RegExp(`^${PERSISTENT_PROPERTY_KEY}:.*\\n?`, 'm'), '');
                    }
                } else if (persistent) {
                    // Insert
                    newContent = newContent.replace(
                        new RegExp(`(${REMINDER_PROPERTY_KEY}:.*)`),
                        `$1\n${PERSISTENT_PROPERTY_KEY}: ${persistent}`
                    );
                }
            }

            // Update Title
            if (title !== undefined) {
                if (newContent.match(new RegExp(`${TITLE_PROPERTY_KEY}:.*`))) {
                    if (title) {
                        newContent = newContent.replace(
                            new RegExp(`${TITLE_PROPERTY_KEY}:.*`),
                            `${TITLE_PROPERTY_KEY}: ${title}`
                        );
                    } else {
                        newContent = newContent.replace(new RegExp(`^${TITLE_PROPERTY_KEY}:.*\\n?`, 'm'), '');
                    }
                } else if (title) {
                    // Insert
                    newContent = newContent.replace(
                        new RegExp(`(${REMINDER_PROPERTY_KEY}:.*)`),
                        `$1\n${TITLE_PROPERTY_KEY}: ${title}`
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
    } catch (e: any) {
        console.warn('[ReminderService] Failed to update reminder file:', e);

        // If file not found/readable, we should still trigger a sync
        // This allows the notification for a deleted file to be cleaned up
        if (e.message?.includes('not readable') || e.message?.includes('does not exist')) {
            await syncAllReminders();
            return; // Treated as success (cleanup)
        }
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
    siblingFileUri?: string
): Promise<{ uri: string, fileName: string } | null> {
    try {
        const { vaultUri, defaultReminderFolder, remindersScanFolder } = useSettingsStore.getState();
        if (!vaultUri) return null;

        let targetFolderUri = vaultUri;
        const { checkDirectoryExists } = await import('../utils/saf');

        // Prioritize sibling location
        let foundSiblingFolder = false;
        if (siblingFileUri) {
            const parentUri = await getParentFolderUri(vaultUri, siblingFileUri);
            if (parentUri) {
                targetFolderUri = parentUri;
                foundSiblingFolder = true;
            }
        }

        if (!foundSiblingFolder) {
            if (defaultReminderFolder && defaultReminderFolder.trim()) {
                const folderUri = await checkDirectoryExists(vaultUri, defaultReminderFolder.trim());
                if (folderUri) targetFolderUri = folderUri;
            } else if (remindersScanFolder && remindersScanFolder.trim()) {
                const folderUri = await checkDirectoryExists(vaultUri, remindersScanFolder.trim());
                if (folderUri) targetFolderUri = folderUri;
            }
        }

        const baseName = title || 'Reminder';
        const fileName = await getUniqueFilename(targetFolderUri, baseName);

        let frontmatter = `reminder_datetime: ${date}`;
        if (title && title.trim()) frontmatter += `\n${TITLE_PROPERTY_KEY}: ${title}`;
        if (recurrence && recurrence.trim()) frontmatter += `\n${RECURRENT_PROPERTY_KEY}: ${recurrence}`;
        if (alarm === true) frontmatter += `\n${ALARM_PROPERTY_KEY}: true`;
        if (persistent !== undefined && persistent !== null && !isNaN(persistent)) frontmatter += `\n${PERSISTENT_PROPERTY_KEY}: ${persistent}`;

        // Add additional props
        for (const [key, value] of Object.entries(additionalProps)) {
            // Avoid duplicates if they were passed in standard args
            if ([REMINDER_PROPERTY_KEY, TITLE_PROPERTY_KEY, RECURRENT_PROPERTY_KEY, ALARM_PROPERTY_KEY, PERSISTENT_PROPERTY_KEY].includes(key)) continue;

            // Skip undefined, null, or empty string values
            if (value === undefined || value === null || value === '') continue;

            frontmatter += `\n${key}: ${value}`;
        }

        // Add tags
        if (tags.length > 0) {
            frontmatter += `\ntags: [${tags.join(', ')}]`;
        }

        const content = `---\n${frontmatter}\n---\n# ${baseName}\n\nCreated via Reminders App.`;
        const fileUri = await StorageAccessFramework.createFileAsync(targetFolderUri, fileName, 'text/markdown');
        await StorageAccessFramework.writeAsStringAsync(fileUri, content);

        // Trigger global sync to update notifications
        await syncAllReminders();

        return { uri: fileUri, fileName };
    } catch (e) {
        console.error('[ReminderService] Failed to create standalone reminder:', e);
        return null;
    }
}

async function scanDirectory(uri: string, reminders: Reminder[], shouldContinue: (count: number) => boolean) {
    if (!shouldContinue(0)) return;

    try {
        const files = await StorageAccessFramework.readDirectoryAsync(uri);

        for (const fileUri of files) {
            if (!shouldContinue(1)) break;

            const decoded = decodeURIComponent(fileUri);

            // If it ends in .md, check it
            if (decoded.endsWith('.md')) {
                await checkFileForReminder(fileUri, reminders);
            }
            // If it has no extension, it *might* be a folder.
            else if (!decoded.split('/').pop()?.includes('.')) {
                try {
                    await scanDirectory(fileUri, reminders, shouldContinue);
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

                const alarmStr = fm[ALARM_PROPERTY_KEY];
                const alarm = alarmStr === 'true';

                const persistentStr = fm[PERSISTENT_PROPERTY_KEY];
                const persistent = persistentStr ? parseInt(persistentStr.replace(/^["']|["']$/g, ''), 10) : undefined;

                const title = fm[TITLE_PROPERTY_KEY] ? fm[TITLE_PROPERTY_KEY].replace(/^["']|["']$/g, '') : undefined;

                reminders.push({
                    fileUri,
                    fileName,
                    title,
                    reminderTime: cleanTime,
                    recurrenceRule,
                    alarm,
                    persistent: isNaN(persistent as number) ? undefined : persistent,
                    content: content.replace(/^---[\s\S]*?---\n/, '').trim() // Full content without frontmatter
                });
            }
        }
    } catch (e) {
        // Error reading file
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
        // This handles removing duplicates or old dates that fell out of the window
        for (const notification of scheduled) {
            if (notification.content.data?.type === 'mood_daily') {
                if (!scheduledDates.has(notification.identifier)) {
                    // It's a mood reminder, but not one we just scheduled/verified.
                    // This catches:
                    // 1. Legacy reminders (random IDs)
                    // 2. Reminders for dates > 7 days out (if any)
                    // 3. Reminders for dates we skipped (past)
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
        // We cancel anything that is a range_start but NOT in our upcoming list (by ID)
        // This also handles cleaning up legacy notifications (which have random IDs)
        for (const notification of scheduled) {
            const data = notification.content.data as Record<string, any>;
            if (data?.type === 'range_start') {
                // If the notification identifier is NOT one of our expected deterministic IDs, cancel it.
                // This covers:
                // 1. Legacy random IDs
                // 2. Ranges that were deleted/disabled
                // 3. Time changed (ID changes if time changes)
                if (!upcomingIds.has(notification.identifier)) {
                    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                }
            }
        }

        // 2. Schedule new ones (or update existing)
        for (const item of upcoming) {
            // Using 'identifier' ensures we don't create duplicates.
            // If it exists, it updates. If not, it creates.
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

// Exported function to be called from background task OR foreground (e.g. after adding a file)
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
    // We check per-reminder 'persistent' flag
    const presented = await Notifications.getPresentedNotificationsAsync();
    const now = Date.now();

    for (const notification of presented) {
        const fileUri = notification.request.content.data?.fileUri as string;
        if (!fileUri) continue;

        // Try to find the reminder to check its persistent setting
        let reminderData = activeReminders.find(r => r.fileUri === fileUri);

        let intervalMs = -1;

        if (reminderData && reminderData.persistent) {
            // Use per-reminder persistence if available
            intervalMs = reminderData.persistent * 60 * 1000;
        }

        if (intervalMs > 0) {
            const triggerTime = notification.date; // timestamp when it was shown
            if (now - triggerTime > intervalMs) {
                // It's stale and ignored. Resend!
                
                // Cancel the old one to clear it from tray
                await Notifications.dismissNotificationAsync(notification.request.identifier);

                // Re-fetch reminder data if we didn't have it (fallback logic)
                if (!reminderData) {
                    // Fallback: Try to read the file directly
                    try {
                        const recovered: Reminder[] = [];
                        await checkFileForReminder(fileUri, recovered);
                        if (recovered.length > 0) {
                            reminderData = recovered[0];
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
    // We remove any notification that:
    // a) Is a file reminder but not in activeReminders
    // b) Has the wrong ID (legacy or time changed)
    const activeReminderIds = new Set<string>();

    // Map active reminders to their expected IDs
    const expectedIds = new Map<string, string>(); // fileUri -> deterministic Notification ID
    const expectedNativeIds = new Map<string, number>(); // fileUri -> deterministic Alarm ID

    activeReminders.forEach(r => {
        // Notification ID (string) depends on fileUri AND time to allow history/updates
        const id = `reminder-${getHash(r.fileUri)}-${getHash(r.reminderTime)}`;
        expectedIds.set(r.fileUri, id);

        // Native Alarm ID (int) depends ONLY on fileUri to prevent duplication.
        // If the time changes, the SAME native alarm ID will be rescheduled for the new time,
        // which automatically updates/replaces the old one in Android.
        const nativeId = Math.abs(getHash(r.fileUri)) % 2147483647; // Stay in signed 32-bit int range
        expectedNativeIds.set(r.fileUri, nativeId);

        activeReminderIds.add(id);
    });

    for (const notification of scheduled) {
        const fileUri = (notification.content.data as any)?.fileUri;

        if (!fileUri) continue; // Not a file reminder (or malformed)

        // Check if this notification's ID matches what we expect for this file
        // If the ID is random (legacy), or for an old time, it won't match activeReminderIds
        if (!activeReminderIds.has(notification.identifier)) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);

            // Also explicitly cancel the native alarm if it exists for this file
            const nativeId = expectedNativeIds.get(fileUri) || (Math.abs(getHash(fileUri)) % 2147483647);
            await stopNativeAlarm(nativeId);
        }
    }

    // 3. Schedule missing notifications
    const nowTime = new Date();
    const MAX_CONCURRENT_ALARMS = 64; // OS limit safety

    // Sort reminders by time so we prioritize the most immediate ones
    const sortedReminders = [...activeReminders].sort((a, b) =>
        new Date(a.reminderTime).getTime() - new Date(b.reminderTime).getTime()
    );

    let scheduledCount = 0;

    for (const reminder of sortedReminders) {
        const remDate = new Date(reminder.reminderTime);
        const expectedId = expectedIds.get(reminder.fileUri);
        const expectedNativeId = expectedNativeIds.get(reminder.fileUri);

        if (remDate <= nowTime) {
            // Check if it was recent (within 15 mins) and NOT already notified
            const diff = nowTime.getTime() - remDate.getTime();
            if (diff < 15 * 60 * 1000) {
                // It's recent.
                if (reminder.recurrenceRule) {
                    // It's overdue and repeating. Advance it!
                    const nextDate = calculateNextRecurrence(remDate, reminder.recurrenceRule);
                    if (nextDate && nextDate > nowTime) {
                        
                        // Update the file content
                        await updateReminder(reminder.fileUri, nextDate.toISOString(), reminder.recurrenceRule);
                        continue;
                    }
                }
                // If not recurring or invalid recurrence, skip (stale)
                continue;
            }
        }

        // Schedule it (or update if exists)
        if (remDate > nowTime) {
            if (scheduledCount >= MAX_CONCURRENT_ALARMS) {
                break;
            }

            // We pass the deterministic IDs.
            await scheduleNotification(reminder, false, expectedId, expectedNativeId);
            scheduledCount++;
        }
    }
}

async function scheduleNotification(reminder: Reminder, immediate = false, identifier?: string, nativeId?: number) {
    if (reminder.alarm) {
        // Use native alarm module for "Alarm" style reminders (blocking, looping sound)
        const timestamp = immediate ? Date.now() + 1000 : new Date(reminder.reminderTime).getTime();
        const activeNativeId = nativeId || (Math.abs(getHash(reminder.fileUri)) % 2147483647);

        const success = await scheduleNativeAlarm(
            reminder.fileName.replace('.md', ''),
            reminder.content || "Alarm Reminder",
            timestamp,
            activeNativeId
        );
        if (success) {
            return;
        }
        // Fallback to standard notification if native fails (shouldn't happen on Android)
    }

    const id = await Notifications.scheduleNotificationAsync({
        identifier: identifier,
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
}
