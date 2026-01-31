import { saveToVault, readFileContent, checkFileExists } from '../utils/saf';
import { useSettingsStore } from '../store/settings';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';

export interface EventType {
    id: string;
    title: string;
    color: string;
}

export interface EventTypeConfig {
    types: EventType[];
    assignments: Record<string, string>; // Event Title -> Type ID
    difficulties?: Record<string, number>; // Event Title -> Difficulty (0-5)
    ranges?: TimeRangeDefinition[];
}

const CONFIG_FILENAME = 'event-types.json';

export const saveEventTypesToVault = async (config: EventTypeConfig, vaultUri: string) => {
    try {
        const content = JSON.stringify(config, null, 2);
        await saveToVault(vaultUri, CONFIG_FILENAME, content);
    } catch (e) {
        console.error('[EventTypeService] Failed to save config:', e);
        throw e;
    }
};

export const loadEventTypesFromVault = async (vaultUri: string): Promise<EventTypeConfig | null> => {
    try {
        const exists = await checkFileExists(vaultUri, CONFIG_FILENAME);
        if (!exists) return null;

        const content = await readFileContent(vaultUri, CONFIG_FILENAME);
        return JSON.parse(content);
    } catch (e) {
        console.error('[EventTypeService] Failed to load config:', e);
        return null;
    }
};
