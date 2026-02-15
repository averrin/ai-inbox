import { readFileContent, saveToVault, checkFileExists, deleteFileByPath } from "../utils/saf";
import { ProfileLogic, ProfileData, DEFAULT_PROFILE } from './profileLogic';

export { ProfileData, DEFAULT_PROFILE };

export class ProfileService {
    static async loadProfile(vaultUri: string): Promise<ProfileData> {
        try {
            // Migration check: Look for Profile.json.md (mistakenly created)
            const existsMd = await checkFileExists(vaultUri, 'Profile.json.md');
            if (existsMd) {
                try {
                    const content = await readFileContent(vaultUri, 'Profile.json.md');
                    const parsed = JSON.parse(content);

                    // Save correctly
                    await this.saveProfile(vaultUri, parsed);

                    // Delete legacy file to prevent re-migration
                    await deleteFileByPath(vaultUri, 'Profile.json.md');
                } catch (migErr) {
                    console.error('[ProfileService] Migration failed:', migErr);
                }
            }

            const exists = await checkFileExists(vaultUri, 'Profile.json');

            if (!exists) {
                return DEFAULT_PROFILE;
            }
            const content = await readFileContent(vaultUri, 'Profile.json');
            const parsed = JSON.parse(content);
            return parsed;
        } catch (e) {
            console.error('[ProfileService] Failed to load profile:', e);
            return DEFAULT_PROFILE;
        }
    }

    static async saveProfile(vaultUri: string, profile: ProfileData): Promise<void> {
        try {
            // Explicitly use application/json to prevent .md extension
            await saveToVault(vaultUri, 'Profile.json', JSON.stringify(profile, null, 2), undefined, 'application/json');
        } catch (e) {
            console.error('[ProfileService] Failed to save profile:', e);
            throw e;
        }
    }

    static async generateDailyQuestions(
        modelName: string,
        apiKey: string,
        profile: ProfileData,
        history: string[],
        config: { targetTopic?: string, questionCount: number, forbiddenTopics: string[], abstractionLevel: number }
    ): Promise<{ questions: { text: string; level: number }[], reasoning: string }> {
        return ProfileLogic.generateDailyQuestions(modelName, apiKey, profile, history, config);
    }

    static async processAnswers(
        modelName: string,
        apiKey: string,
        profile: ProfileData,
        questions: string[],
        answers: Record<string, string>
    ): Promise<ProfileData> {
        return ProfileLogic.processAnswers(modelName, apiKey, profile, questions, answers);
    }

    static generateProfileImagePrompt(profile: ProfileData): string {
        return ProfileLogic.generateProfileImagePrompt(profile);
    }
}
