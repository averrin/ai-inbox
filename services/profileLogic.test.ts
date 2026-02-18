import { ProfileLogic, DEFAULT_PROFILE } from './profileLogic';
import assert from 'node:assert';

// Mock fetch
const originalFetch = global.fetch;
const mockFetch: any = (url: string, options: any) => {
    mockFetch.calls.push({ url, options });
    if (mockFetch.response) return Promise.resolve(mockFetch.response);
    return Promise.resolve({
        ok: true,
        json: async () => ({}),
        text: async () => "{}"
    });
};
mockFetch.calls = [] as any[];
mockFetch.response = null as any;

global.fetch = mockFetch as any;

async function runTests() {
    console.log('Running ProfileLogic tests...');

    // Mock Gemini response structure helper
    const mockGeminiResponse = (text: string) => ({
        ok: true,
        json: async () => ({
            candidates: [{
                content: {
                    parts: [{ text }]
                }
            }]
        }),
        text: async () => JSON.stringify({
            candidates: [{
                content: {
                    parts: [{ text }]
                }
            }]
        })
    });

    try {
        console.log('Test: generateDailyQuestions should call Gemini API');
        mockFetch.calls = [];

        mockFetch.response = mockGeminiResponse(JSON.stringify({
            questions: [{ text: "What is your quest?", level: 0.5 }, { text: "What is your favorite color?", level: 0.2 }],
            reasoning: "Testing"
        }));

        const result = await ProfileLogic.generateDailyQuestions(
            'gemini-1.5-flash',
            'test-key',
            DEFAULT_PROFILE,
            [],
            { questionCount: 2, forbiddenTopics: [], abstractionLevel: 0.5 }
        );

        assert.strictEqual(mockFetch.calls.length, 1);
        const call = mockFetch.calls[0];

        // Check signature
        assert.deepStrictEqual(result.questions, [{ text: "What is your quest?", level: 0.5 }, { text: "What is your favorite color?", level: 0.2 }]);
        console.log('PASS');

    } catch (e) {
        console.error('FAIL generateDailyQuestions', e);
        process.exit(1);
    }

    try {
        console.log('Test: processAnswers should return updated profile');
        mockFetch.calls = [];

        mockFetch.response = mockGeminiResponse(JSON.stringify({
            facts: { hobby: "Coding" },
            topics: ["Tech"]
        }));

        const result = await ProfileLogic.processAnswers(
            'gemini-1.5-flash',
            'test-key',
            DEFAULT_PROFILE,
            ["What do you do?"],
            { "What do you do?": "I code." }
        );

        assert.strictEqual(mockFetch.calls.length, 1);
        assert.deepStrictEqual(result.facts, { hobby: "Coding" });
        assert.deepStrictEqual(result.topics, ["Tech"]);
        console.log('PASS');

    } catch (e) {
        console.error('FAIL processAnswers', e);
        process.exit(1);
    }

    try {
        console.log('Test: processFreeFormInput should return updated profile from text');
        mockFetch.calls = [];

        mockFetch.response = mockGeminiResponse(JSON.stringify({
            facts: { location: "Paris", like: "Croissants" },
            topics: ["Travel", "Food"]
        }));

        const result = await ProfileLogic.processFreeFormInput(
            'gemini-1.5-flash',
            'test-key',
            DEFAULT_PROFILE,
            "I live in Paris and I love croissants."
        );

        assert.strictEqual(mockFetch.calls.length, 1);
        const call = mockFetch.calls[0];
        const body = JSON.parse(call.options.body);
        const promptText = body.contents[0].parts[0].text;

        assert.ok(promptText.includes('Architect'), 'Prompt should contain Architect role');
        assert.ok(promptText.includes('Paris'), 'Prompt should contain input text');

        assert.deepStrictEqual(result.facts, { location: "Paris", like: "Croissants" });
        assert.deepStrictEqual(result.topics, ["Travel", "Food"]);
        console.log('PASS');

    } catch (e) {
        console.error('FAIL processFreeFormInput', e);
        // It might fail if I didn't update the prompt check logic correctly or if the method name isn't in the prompt text directly but the prompt content is.
        // The prompt constant PROFILE_FACT_EXTRACTOR_PROMPT contains "Architect".
        // Let's relax the assertion if needed, but for now strict check.
        process.exit(1);
    }
}

runTests().then(() => {
    console.log('All tests passed');
    global.fetch = originalFetch;
}).catch(e => {
    console.error('Test suite failed', e);
    process.exit(1);
});
