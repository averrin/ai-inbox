import { readFileContent, saveToVault, checkFileExists } from "../utils/saf";
import { ProfileLogic, ProfileData, DEFAULT_PROFILE } from './profileLogic';

export { ProfileData, DEFAULT_PROFILE };

export class ProfileService {
    static async loadProfile(vaultUri: string): Promise<ProfileData> {
        try {
            const exists = await checkFileExists(vaultUri, 'Profile.json');
            if (!exists) {
                return DEFAULT_PROFILE;
            }
            const content = await readFileContent(vaultUri, 'Profile.json');
            return JSON.parse(content);
        } catch (e) {
            console.error('[ProfileService] Failed to load profile:', e);
            return DEFAULT_PROFILE;
        }
    }

    static async saveProfile(vaultUri: string, profile: ProfileData): Promise<void> {
        try {
            await saveToVault(vaultUri, 'Profile.json', JSON.stringify(profile, null, 2));
        } catch (e) {
            console.error('[ProfileService] Failed to save profile:', e);
            throw e;
        }
    }

    static async generateDailyQuestions(
        apiKey: string,
        profile: ProfileData,
        history: string[],
        config: { targetTopic?: string, questionCount: number, forbiddenTopics: string[] }
    ): Promise<{ questions: string[], reasoning: string }> {
        return ProfileLogic.generateDailyQuestions(apiKey, profile, history, config);
    }

    static async processAnswers(
        apiKey: string,
        profile: ProfileData,
        questions: string[],
        answers: Record<string, string>
    ): Promise<ProfileData> {
        return ProfileLogic.processAnswers(apiKey, profile, questions, answers);
    }
}
