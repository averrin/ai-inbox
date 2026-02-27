import { useSettingsStore } from '../store/settings';
import { useEventTypesStore } from '../store/eventTypes';
import { useMoodStore } from '../store/moodStore';
import { Platform } from 'react-native';
import dayjs from 'dayjs';
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
            content: bodyContent || '',
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



export async function syncAllReminders() {
    try {
        if (!useSettingsStore.persist.hasHydrated()) {
            await useSettingsStore.persist.rehydrate();
        }

        const reminders = await scanForReminders();
        useSettingsStore.getState().setCachedReminders(reminders);
        return reminders;
    } catch (error) {
        console.error('[ReminderService] Sync failed:', error);
        return [];
    }
}



