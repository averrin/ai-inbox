import { sendMessageToSession, deleteJulesSession } from './julesApi';
import assert from 'node:assert';

// Mock fetch
const originalFetch = global.fetch;
const mockFetch = (url: string, options: any) => {
    mockFetch.calls.push([url, options]);
    return mockFetch.response || { ok: true, json: async () => ({}) };
};
mockFetch.calls = [] as any[];
mockFetch.response = null as any;

global.fetch = mockFetch as any;

async function runTests() {
    console.log('Running tests...');

    try {
        console.log('Test: sendMessageToSession should send correct payload');
        mockFetch.calls = [];
        mockFetch.response = { ok: true, json: async () => ({}) };

        await sendMessageToSession('test-api-key', 'sessions/123', 'test message');

        assert.strictEqual(mockFetch.calls.length, 1);
        const [url, options] = mockFetch.calls[0];

        assert.strictEqual(url, 'https://jules.googleapis.com/v1alpha/sessions/123:sendMessage');
        assert.strictEqual(options.method, 'POST');
        assert.strictEqual(options.headers['x-goog-api-key'], 'test-api-key');

        const body = JSON.parse(options.body);
        assert.deepStrictEqual(body, {
            prompt: 'test message'
        });
        console.log('PASS');
    } catch (e) {
        console.error('FAIL', e);
        process.exit(1);
    }

    try {
        console.log('Test: sendMessageToSession should throw error on failure');
        mockFetch.calls = [];
        mockFetch.response = {
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
        };

        let threw = false;
        try {
            await sendMessageToSession('key', 'sess', 'msg');
        } catch (e: any) {
            threw = true;
            assert.ok(e.message.includes('500 Internal Server Error'));
        }
        assert.strictEqual(threw, true);
        console.log('PASS');
    } catch (e) {
        console.error('FAIL', e);
        process.exit(1);
    }

    try {
        console.log('Test: deleteJulesSession should call DELETE endpoint');
        mockFetch.calls = [];
        mockFetch.response = { ok: true, text: async () => '' };

        await deleteJulesSession('test-api-key', 'sessions/123');

        assert.strictEqual(mockFetch.calls.length, 1);
        const [url2, options2] = mockFetch.calls[0];

        assert.strictEqual(url2, 'https://jules.googleapis.com/v1alpha/sessions/123');
        assert.strictEqual(options2.method, 'DELETE');
        assert.strictEqual(options2.headers['x-goog-api-key'], 'test-api-key');
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
