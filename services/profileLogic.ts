import { GoogleGenerativeAI } from "@google/generative-ai";
import JSON5 from 'json5';

export const ARCHITECT_PROMPT = `
# ROLE DEFINITION
You are the "Architect," a highly perceptive AI designed to build a profound, evolving, and high-fidelity mental model of the User. Your goal is not just to gather facts, but to understand the User's motivations, values, quirks, history, and aspirations.

# INPUT DATA
You will be provided with:
1.  **Current Profile Context:** A summary of what we already know about the User.
2.  **Interaction History:** The last few questions asked to ensure flow.
3.  **Configuration Variables:**
    * \`Target_Topic\` (Optional): A specific area to focus on (e.g., "Career," "Childhood," "Philosophy").
    * \`Question_Count\`: The number of questions to generate.
    * \`Forbidden_Topics\`: Areas to strictly avoid.
    * \`Target_Abstraction_Level\`: A scale from 0 to 1.
        * **0.0 - 0.3 (Low):** Factual, concrete, demographics, objective (e.g., "What is your height?", "What is your mother tongue?").
        * **0.4 - 0.7 (Mid):** Habits, routines, preferences, situational logic.
        * **0.8 - 1.0 (High):** Abstract, philosophical, values-based, deep psychological traits.

# CORE DIRECTIVES

## 1. Abstraction Variance
DO NOT generate all questions at the exact same abstraction level. Instead, generate a set of questions that *variate* around the \`Target_Abstraction_Level\`. 
For example, if the target is 0.2 (Low), you might ask one very concrete question (0.1) and one slightly more routine-based question (0.3).

## 2. Gap Analysis & Strategy
Before asking, analyze the \`Current Profile Context\`. Identify "white space" in the map of the User. Match the gaps to the requested abstraction level.

## 3. The "Never-Ending" Logic
To ensure the questions never run out, utilize these four dimensions:
* **The Specific:** Drill down.
* **The Abstract:** Link facts to values.
* **The Temporal:** Past and Future.
* **The Hypothetical:** Stress-test the profile.

# OUTPUT FORMAT
Return your response in JSON format:
{
  "reasoning": "Brief explanation of why you chose these specific questions and levels.",
  "questions": [
    { "text": "Question 1 string", "level": 0.2 },
    { "text": "Question 2 string", "level": 0.8 }
  ]
}
`;

export const PROFILE_UPDATER_PROMPT = `
You are a "Profile Updater" AI. Your task is to extract permanent facts, preferences, and psychological traits from the user's answers to profile questions.

Input:
1. Current Profile JSON
2. Questions Asked
3. User Answers

Instructions:
1. Analyze the user's answers.
2. Extract new information.
3. Update the Current Profile JSON.
4. Discard conversational fluff.
5. Merge similar topics or create new categories as needed.
6. If an answer contradicts existing info, note the evolution or nuance.

Output:
Return ONLY the updated Profile JSON. No markdown formatting.
`;

export interface ProfileData {
    facts: Record<string, any>;
    topics: string[];
    recentQuestions: string[];
    traits?: string[]; // Added to accommodate AI findings
    lastUpdated: string;
}

export const DEFAULT_PROFILE: ProfileData = {
    facts: {},
    topics: [],
    recentQuestions: [],
    traits: [],
    lastUpdated: new Date().toISOString()
};

export class ProfileLogic {
    static async generateDailyQuestions(
        modelName: string,
        apiKey: string,
        profile: ProfileData,
        history: string[],
        config: { targetTopic?: string, questionCount: number, forbiddenTopics: string[], abstractionLevel: number }
    ): Promise<{ questions: { text: string, level: number }[], reasoning: string }> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName || "gemini-1.5-flash" });

        // Use history passed in args OR fallback to profile.recentQuestions
        const effectiveHistory = history.length > 0 ? history : (profile.recentQuestions || []);

        const prompt = `${ARCHITECT_PROMPT}

# CURRENT CONTEXT
Current Profile: ${JSON.stringify(profile.facts)}
Interaction History: ${JSON.stringify(effectiveHistory)}

# CONFIGURATION
Target_Topic: ${config.targetTopic || "Random (Based on gaps)"}
Question_Count: ${config.questionCount}
Forbidden_Topics: ${JSON.stringify(config.forbiddenTopics)}
Target_Abstraction_Level: ${config.abstractionLevel}
`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Extract first JSON block
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start === -1 || end === -1 || end < start) {
                throw new Error("No valid JSON found in response");
            }
            const jsonStr = text.substring(start, end + 1);

            const parsed = JSON5.parse(jsonStr);
            return {
                questions: parsed.questions || [],
                reasoning: parsed.reasoning || ""
            };
        } catch (e) {
            console.error('[ProfileLogic] Failed to generate questions:', e);
            throw e;
        }
    }

    static async processAnswers(
        modelName: string,
        apiKey: string,
        profile: ProfileData,
        questions: string[],
        answers: Record<string, string>
    ): Promise<ProfileData> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName || "gemini-1.5-flash" });

        const prompt = `${PROFILE_UPDATER_PROMPT}

# INPUT
Current Profile: ${JSON.stringify(profile)}
Questions: ${JSON.stringify(questions)}
User Answers: ${JSON.stringify(answers)}
`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Extract JSON
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start === -1 || end === -1 || end < start) {
                throw new Error("No valid JSON found in response");
            }
            const jsonStr = text.substring(start, end + 1);

            const updated = JSON5.parse(jsonStr);

            // Maintain recent questions history (last 10)
            const oldHistory = profile.recentQuestions || [];
            const newHistory = [...oldHistory, ...questions].slice(-10);

            // Strictly merge to prevent pollution and ensure correctness
            const resultProfile: ProfileData = {
                facts: { ...(profile.facts || {}), ...(updated.facts || {}) },
                topics: updated.topics || profile.topics || [],
                traits: updated.traits || profile.traits || [],
                recentQuestions: newHistory,
                lastUpdated: new Date().toISOString()
            };

            return resultProfile;
        } catch (e) {
            console.error('[ProfileLogic] Failed to process answers:', e);
            throw e;
        }
    }
}
