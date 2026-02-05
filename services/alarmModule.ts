import { NativeModules, Platform } from 'react-native';

const { AlarmModule } = NativeModules;

interface AlarmInterface {
    scheduleAlarm(title: string, message: string, timestamp: number, id: number): Promise<boolean>;
    stopAlarm(id: number): Promise<boolean>;
    getLaunchAlarmDetails(): Promise<{ id: number, title?: string, message?: string } | null>;
    cancelAllAlarms(): Promise<boolean>;
}

export const scheduleNativeAlarm = async (title: string, message: string, timestamp: number, id: number) => {
    if (Platform.OS === 'android' && AlarmModule) {
        return await AlarmModule.scheduleAlarm(title, message, timestamp, id);
    }
    if (Platform.OS === 'android') {
        console.warn("AlarmModule is not linked. Rebuild the app.");
    }
    return false;
};

export const stopNativeAlarm = async (id: number) => {
    if (Platform.OS === 'android' && AlarmModule) {
        return await AlarmModule.stopAlarm(id);
    }
    return false;
};

export const getLaunchAlarmDetails = async (): Promise<{ id: number, title?: string, message?: string } | null> => {
    if (Platform.OS === 'android' && AlarmModule) {
        return await AlarmModule.getLaunchAlarmDetails();
    }
    return null;
};

export const cancelAllNativeAlarms = async () => {
    if (Platform.OS === 'android' && AlarmModule) {
        return await AlarmModule.cancelAllAlarms();
    }
    return false;
};

export const dismissNativeNotification = async (id: number) => {
    if (Platform.OS === 'android' && AlarmModule) {
        return await AlarmModule.dismissNotification(id);
    }
};
