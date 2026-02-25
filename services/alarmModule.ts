import { Platform } from 'react-native';
import { setAlarm, dismissAlarm } from 'expo-alarm';
import dayjs from 'dayjs';

// scheduleNativeAlarm(title, message, timestamp, id)
export const scheduleNativeAlarm = async (title: string, message: string, timestamp: number, id: number) => {
    if (Platform.OS !== 'android') return false;

    try {
        const targetDate = dayjs(timestamp);
        const now = dayjs();

        // If target is in the past, don't schedule
        if (targetDate.isBefore(now)) return false;

        // Calculate when the system would schedule an alarm for target's H:M
        // System logic (AlarmClock): Next occurrence of H:M
        let candidate = now
            .hour(targetDate.hour())
            .minute(targetDate.minute())
            .second(0)
            .millisecond(0);

        // If candidate time is before now (passed today), the system will schedule for tomorrow
        if (candidate.isBefore(now)) {
            candidate = candidate.add(1, 'day');
        }

        // Compare candidate with targetDate
        // We allow a small tolerance (e.g., 1 minute) to account for seconds/ms differences
        const diffInMinutes = Math.abs(candidate.diff(targetDate, 'minute'));

        // If the calculated system alarm time is not within 1 minute of the target time,
        // it means the target date is further in the future than the next occurrence.
        // In this case, we cannot use the system alarm yet.
        if (diffInMinutes > 1) {
            return false;
        }

        await setAlarm({
            hour: targetDate.hour(),
            minutes: targetDate.minute(),
            message: title, // Use title as the label/message
            skipUi: true,
            days: [] // One-time alarm
        });

        return true;
    } catch (e) {
        console.warn("[AlarmModule] Failed to set native alarm:", e);
        return false;
    }
};

// Modified signature to accept title instead of ID, as expo-alarm (Intents) works with labels
export const stopNativeAlarm = async (title: string) => {
    if (Platform.OS !== 'android') return;
    try {
        await dismissAlarm({
            searchMode: 'android.label',
            message: title,
            skipUi: true,
        } as any);
    } catch (e) {
        console.warn("[AlarmModule] Failed to stop native alarm:", e);
    }
};

export const getLaunchAlarmDetails = async () => {
    // expo-alarm does not support retrieving launch details as it uses system Intents
    return null;
};

export const cancelAllNativeAlarms = async () => {
    // Not supported reliably with expo-alarm (requires clearing all system alarms which is destructive)
    return false;
};

export const dismissNativeNotification = async (id: number) => {
    // No-op as we no longer use custom native notifications from alarmee
};
