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
        const tempId = `temp-${Date.now()}`;

        try {
            // Use local ISO format for storage/display
            const { toLocalISOString } = await import('../services/reminderService');
            const timeStr = toLocalISOString(date);

            // 3. Optimistic Update
            const newReminder: Reminder = {
                id: tempId,
                fileUri: tempId, // Temporary ID/URI
                fileName: title || 'Reminder',
                title: title || 'Reminder',
                reminderTime: timeStr,
                recurrenceRule: recurrence || undefined,
                alarm: alarm,
                persistent: persistent,
                content: 'Created via Reminders App.'
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
        } catch (e) {
            console.error("Initialization failed in addReminder:", e);
            Toast.show({ type: 'error', text1: 'Failed to initialize reminder creation' });
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
            // In new service, null time means delete document
            await updateReminder(reminder.fileUri, null);
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
