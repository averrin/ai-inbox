import { NativeModulesProxy, EventEmitter } from 'expo-modules-core';

// Import the native module. On web, it will be null.
import { requireNativeModule } from 'expo-modules-core';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const AlarmeeModule = requireNativeModule('AlarmeeModule');

export function scheduleAlarm(
  title: string,
  message: string,
  timestamp: number,
  id: string
): Promise<boolean> {
  if (AlarmeeModule) {
      return AlarmeeModule.scheduleAlarm(title, message, timestamp, id);
  }
  return Promise.resolve(false);
}

export function cancelAlarm(id: string): Promise<boolean> {
  if (AlarmeeModule) {
    return AlarmeeModule.cancelAlarm(id);
  }
  return Promise.resolve(false);
}

export function cancelAllAlarms(): Promise<boolean> {
  if (AlarmeeModule) {
    return AlarmeeModule.cancelAllAlarms();
  }
  return Promise.resolve(false);
}
