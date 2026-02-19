import { saveToVault, readFileContent, checkFileExists } from '../utils/saf';
import { useSettingsStore } from '../store/settings';
import { TimeRangeDefinition } from '../components/ui/calendar/interfaces';

export interface EventType {
    id: string;
    title: string;
    color: string;
    hideBadges?: boolean; // Hide corner badges for events of this type
    isInverted?: boolean;
    icon?: string;
}

export interface EventTypeConfig {
    types: EventType[];
    assignments: Record<string, string>; // Event Title -> Type ID
    difficulties?: Record<string, number>; // Event Title -> Difficulty (0-5)
    ranges?: TimeRangeDefinition[];
    eventFlags?: Record<string, { isEnglish?: boolean; movable?: boolean; skippable?: boolean; needPrep?: boolean; completable?: boolean }>; // Event Title -> Flags
    eventIcons?: Record<string, string>; // Event Title -> Icon Name
    lunchConfig?: {
        targetCalendarId?: string;
        defaultInvitee?: string;
    };
}

const CONFIG_FILENAME = 'event-types.json';

/** @deprecated Use Firestore instead. This is only kept for one-time migration. */
export const loadEventTypesFromVault = async (vaultUri: string): Promise<EventTypeConfig | null> => {
    try {
        const exists = await checkFileExists(vaultUri, CONFIG_FILENAME);
        if (!exists) return null;

        const content = await readFileContent(vaultUri, CONFIG_FILENAME);
        return JSON.parse(content);
    } catch (e) {
        console.error('[EventTypeService] Failed to load legacy config:', e);
        return null;
    }
};
