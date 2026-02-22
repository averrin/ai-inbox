import { Platform } from 'react-native';
import { scheduleAlarm, cancelAlarm, cancelAllAlarms } from 'alarmee-native';

export const scheduleNativeAlarm = async (title: string, message: string, timestamp: number, id: number) => {
    if (Platform.OS === 'android') {
        // Convert numeric ID to string ID used by alarmee
        const uuid = `alarm-${id}`;
        return await scheduleAlarm(title, message, timestamp, uuid);
    }
    return false;
};

export const stopNativeAlarm = async (id: number) => {
    if (Platform.OS === 'android') {
        const uuid = `alarm-${id}`;
        return await cancelAlarm(uuid);
    }
    return false;
};

export const getLaunchAlarmDetails = async (): Promise<{ id: number, title?: string, message?: string } | null> => {
    // Not implemented in alarmee wrapper yet
    return null;
};

export const cancelAllNativeAlarms = async () => {
    if (Platform.OS === 'android') {
        return await cancelAllAlarms();
    }
    return false;
};

export const dismissNativeNotification = async (id: number) => {
    // Alarmee cancel removes notification too
    if (Platform.OS === 'android') {
        const uuid = `alarm-${id}`;
        return await cancelAlarm(uuid);
    }
};
