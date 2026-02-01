import { useState, useCallback } from 'react';
import { Reminder, syncAllReminders, updateReminder } from '../services/reminderService';
import { useSettingsStore } from '../store/settings';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';
import { Alert } from 'react-native';

export function useOptimisticReminders() {
    const {
        cachedReminders,
        setCachedReminders,
        vaultUri,
        remindersScanFolder,
        defaultReminderFolder
    } = useSettingsStore();

    const [pendingOperations, setPendingOperations] = useState<number>(0);

    const addReminder = useCallback(async (
        title: string,
        date: Date,
        recurrence: string,
        alarm: boolean,
        persistent?: number
    ) => {
        if (!vaultUri) {
            Alert.alert("Error", "Vault URI not set.");
            return;
        }

        const tempId = `temp-${Date.now()}`;
        // Use local ISO format for storage/display
        const { toLocalISOString, getUniqueFilename } = await import('../services/reminderService');
        const timeStr = toLocalISOString(date);

        // 1. Determine Target Folder
        let targetUri = vaultUri;
        const { checkDirectoryExists } = await import('../utils/saf');

        if (defaultReminderFolder && defaultReminderFolder.trim()) {
            const folderUri = await checkDirectoryExists(vaultUri, defaultReminderFolder.trim());
            if (folderUri) targetUri = folderUri;
        } else if (remindersScanFolder && remindersScanFolder.trim()) {
            const folderUri = await checkDirectoryExists(vaultUri, remindersScanFolder.trim());
            if (folderUri) targetUri = folderUri;
        }

        // 2. Generate Unique Filename
        const fileName = await getUniqueFilename(targetUri, title);

        // 3. Optimistic Update
        const newReminder: Reminder = {
            fileUri: tempId, // Temporary ID/URI
            fileName: fileName,
            reminderTime: timeStr,
            recurrenceRule: recurrence || undefined,
            alarm: alarm,
            persistent: persistent,
            content: `---
reminder_datetime: ${timeStr}
${recurrence ? `reminder_recurrent: ${recurrence}` : ''}
${alarm ? `reminder_alarm: true` : ''}
${persistent ? `reminder_persistent: ${persistent}` : ''}
---
# ${title}

Created via Reminders App.`
        };

        const previousReminders = [...(cachedReminders || [])];
        setCachedReminders([...previousReminders, newReminder]);
        setPendingOperations(prev => prev + 1);

        try {
            // 4. Perform Actual Operation using shared service
            const { createStandaloneReminder } = await import('../services/reminderService');
            await createStandaloneReminder(timeStr, title, recurrence, alarm, persistent);
            // Reconcile is handled inside createStandaloneReminder
        } catch (e) {
            console.error(e);
            // 6. Rollback
            setCachedReminders(previousReminders);
            Toast.show({ type: 'error', text1: 'Failed to create reminder' });
        } finally {
            setPendingOperations(prev => prev - 1);
        }
    }, [cachedReminders, setCachedReminders, vaultUri, remindersScanFolder, defaultReminderFolder]);

    const editReminder = useCallback(async (
        originalReminder: Reminder,
        date: Date,
        recurrence: string,
        alarm: boolean,
        persistent?: number
    ) => {
        const previousReminders = [...(cachedReminders || [])];

        const { toLocalISOString } = await import('../services/reminderService');
        const timeStr = toLocalISOString(date);

        // 1. Optimistic Update
        const updatedList = previousReminders.map(r => {
            if (r.fileUri === originalReminder.fileUri) {
                return {
                    ...r,
                    reminderTime: timeStr,
                    recurrenceRule: recurrence || undefined,
                    alarm: alarm,
                    persistent: persistent
                };
            }
            return r;
        });
        setCachedReminders(updatedList);
        setPendingOperations(prev => prev + 1);

        try {
            // 2. Perform Actual UI
            await updateReminder(
                originalReminder.fileUri,
                timeStr,
                recurrence,
                alarm,
                persistent
            );
            await syncAllReminders();
        } catch (e) {
            console.error(e);
            // 3. Rollback
            setCachedReminders(previousReminders);
            Toast.show({ type: 'error', text1: 'Failed to update reminder' });
        } finally {
            setPendingOperations(prev => prev - 1);
        }
    }, [cachedReminders, setCachedReminders]);

    const deleteReminder = useCallback(async (reminder: Reminder, deleteFileArg: boolean) => {
        const previousReminders = [...(cachedReminders || [])];

        // 1. Optimistic Update
        const updatedList = previousReminders.filter(r => r.fileUri !== reminder.fileUri);
        setCachedReminders(updatedList);
        setPendingOperations(prev => prev + 1);

        try {
            // 2. Actual Operation
            if (deleteFileArg) {
                const { deleteFile } = await import('../utils/saf');
                await deleteFile(reminder.fileUri);
            } else {
                await updateReminder(reminder.fileUri, null); // Remove property only
            }
            await syncAllReminders();
        } catch (e) {
            console.error(e);
            // 3. Rollback
            setCachedReminders(previousReminders);
            Toast.show({ type: 'error', text1: 'Failed to delete reminder' });
        } finally {
            setPendingOperations(prev => prev - 1);
        }
    }, [cachedReminders, setCachedReminders]);

    return {
        reminders: cachedReminders || [],
        addReminder,
        editReminder,
        deleteReminder,
        isSyncing: pendingOperations > 0
    };
}
