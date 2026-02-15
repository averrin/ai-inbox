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

# CORE DIRECTIVES

## 1. Gap Analysis & Strategy
Before asking, analyze the \`Current Profile Context\`. Identify "white space" in the map of the User.
* **If the profile is sparse:** Ask foundational questions (Habits, key relationships, core beliefs).
* **If the profile is dense:** Switch to "Second-Order" questions. Don't ask "Do you like coffee?" (if you know they do). Instead, ask "What is your ritual around your morning coffee, and how does it set the tone for your day?"

## 2. The "Never-Ending" Logic
To ensure the questions never run out, utilize these four dimensions:
* **The Specific:** Drill down. (Known: User likes hiking. -> Ask: "What was the most dangerous trail you've ever attempted?")
* **The Abstract:** Link facts to values. (Known: User is a minimalist. -> Ask: "Does your minimalism extend to your digital life or relationships?")
* **The Temporal:** Past and Future. (Known: User is a Designer. -> Ask: "What is a design trend from 10 years ago that you secretly miss?")
* **The Hypothetical:** Stress-test the profile. (Known: User values honesty. -> Ask: "Is there ever a scenario where you believe a lie is the moral choice?")

## 3. Quality Control
* **NO Trivialities:** Do not ask generic "icebreakers" (e.g., "How are you?", "What is the weather?"). Every question must yield permanent context.
* **NO Repetition:** strictly cross-reference \`Current Profile Context\` to ensure you never ask for data you already possess.
* **Natural Flow:** If a \`Target_Topic\` is NOT provided, select a topic that is adjacent to a recently learned fact to make the jump feel organic.

# OUTPUT FORMAT
Return your response in JSON format:
{
  "reasoning": "Brief explanation of why you chose these specific questions based on the current profile gaps.",
  "questions": [
    "Question 1 string",
    "Question 2 string"
  ]
}

# CONSTRAINTS
* Respect all \`Forbidden_Topics\`.
* Maintain a tone that is curious, warm, but professional.
* Keep questions concise but open-ended.
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
    lastUpdated: string;
}

export const DEFAULT_PROFILE: ProfileData = {
    facts: {},
    topics: [],
    recentQuestions: [],
    lastUpdated: new Date().toISOString()
};

export class ProfileLogic {
    static async generateDailyQuestions(
        apiKey: string,
        profile: ProfileData,
        history: string[],
        config: { targetTopic?: string, questionCount: number, forbiddenTopics: string[] }
    ): Promise<{ questions: string[], reasoning: string }> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Use flash for speed

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
`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Parse JSON from response (handle markdown blocks)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in response");
            }

            const parsed = JSON5.parse(jsonMatch[0]);
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
        apiKey: string,
        profile: ProfileData,
        questions: string[],
        answers: Record<string, string>
    ): Promise<ProfileData> {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `${PROFILE_UPDATER_PROMPT}

# INPUT
Current Profile: ${JSON.stringify(profile)}
Questions: ${JSON.stringify(questions)}
User Answers: ${JSON.stringify(answers)}
`;

        try {
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            // Parse JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No JSON found in response");
            }

            const updatedProfile = JSON5.parse(jsonMatch[0]);

            // Maintain recent questions history (last 10)
            const oldHistory = profile.recentQuestions || [];
            const newHistory = [...oldHistory, ...questions].slice(-10);

            // Ensure structure
            return {
                ...DEFAULT_PROFILE,
                ...updatedProfile,
                recentQuestions: newHistory,
                lastUpdated: new Date().toISOString()
            };
        } catch (e) {
            console.error('[ProfileLogic] Failed to process answers:', e);
            throw e;
        }
    }
}
