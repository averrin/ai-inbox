import { ProfileLogic, DEFAULT_PROFILE } from './profileLogic';
import assert from 'node:assert';

// Mock fetch
const originalFetch = global.fetch;
const mockFetch = (url: string, options: any) => {
    mockFetch.calls.push({ url, options });
    if (mockFetch.response) return mockFetch.response;
    return {
        ok: true,
        json: async () => ({}),
        text: async () => "{}"
    };
};
mockFetch.calls = [] as any[];
mockFetch.response = null as any;

global.fetch = mockFetch as any;

async function runTests() {
    console.log('Running ProfileLogic tests...');

    try {
        console.log('Test: generateDailyQuestions should call Gemini API');
        mockFetch.calls = [];
        // Mock Gemini response structure
        const mockResponseBody1 = {
            candidates: [{
                content: {
                    parts: [{ text: JSON.stringify({ questions: ["What is your quest?", "What is your favorite color?"], reasoning: "Testing" }) }]
                }
            }]
        };

        mockFetch.response = {
            ok: true,
            json: async () => mockResponseBody1,
            text: async () => JSON.stringify(mockResponseBody1)
        };

        const result = await ProfileLogic.generateDailyQuestions(
            'test-key',
            DEFAULT_PROFILE,
            [],
            { questionCount: 2, forbiddenTopics: [] }
        );

        assert.strictEqual(mockFetch.calls.length, 1);
        const call = mockFetch.calls[0];
        // Gemini URL pattern
        assert.ok(call.url.includes('generativelanguage.googleapis.com'));

        // Check API key
        if (call.url.includes('key=test-key')) {
             assert.ok(true);
        } else {
             // Maybe it's in headers?
             const headers = call.options.headers;
             let apiKey;
             if (headers && typeof headers.get === 'function') {
                 apiKey = headers.get('x-goog-api-key');
             } else if (headers) {
                 apiKey = headers['x-goog-api-key'];
             }
             assert.strictEqual(apiKey, 'test-key', 'API Key missing');
        }

        const body = JSON.parse(call.options.body);
        // Check prompt content
        const promptText = body.contents[0].parts[0].text;
        assert.ok(promptText.includes('ROLE DEFINITION'));
        assert.ok(promptText.includes('Question_Count: 2'));

        assert.deepStrictEqual(result.questions, ["What is your quest?", "What is your favorite color?"]);
        console.log('PASS');

    } catch (e) {
        console.error('FAIL', e);
        process.exit(1);
    }

    try {
        console.log('Test: processAnswers should return updated profile');
        mockFetch.calls = [];

        const mockResponseBody2 = {
            candidates: [{
                content: {
                    parts: [{ text: JSON.stringify({ facts: { hobby: "Coding" }, topics: ["Tech"] }) }]
                }
            }]
        };

        mockFetch.response = {
            ok: true,
            json: async () => mockResponseBody2,
            text: async () => JSON.stringify(mockResponseBody2)
        };

        const result = await ProfileLogic.processAnswers(
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
        console.error('FAIL', e);
        process.exit(1);
    }
}

runTests().then(() => {
    console.log('All tests passed');
    global.fetch = originalFetch;
});
