const assert = require('assert');

// Log function for output
const log = console.log;

// 1. Test toLocalISOString
function toLocalISOString(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 19);
    return localISOTime;
}

log("Testing toLocalISOString...");
const now = new Date();
const localISO = toLocalISOString(now);
log(`Current Date: ${now.toString()}`);
log(`Local ISO: ${localISO}`);

// Basic check: formatted string should roughly match local hours/minutes
// Note: This test runs in the environment's timezone.
const match = localISO.match(/T(\d{2}):(\d{2}):(\d{2})/);
if (match) {
    const hours = parseInt(match[1]);
    const localHours = now.getHours();
    if (hours === localHours) {
        log("PASS: Hour matches local time.");
    } else {
        log(`FAIL: Hour mismatch. Got ${hours}, expected ${localHours}`);
    }
}

// 2. Test getUniqueFilename Logic (Mocked)
async function getUniqueFilename(existingFiles, baseName) {
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9\s-_]/g, '-').trim();
    let fileName = `${sanitizedName}.md`;
    let counter = 1;

    while (existingFiles.includes(fileName)) {
        fileName = `${sanitizedName} (${counter}).md`;
        counter++;
    }
    return fileName;
}

log("\nTesting getUniqueFilename...");
(async () => {
    const existing = ['Buy Milk.md', 'Meeting.md', 'Task (1).md'];

    // Case A: New file
    let name = await getUniqueFilename(existing, 'New Task');
    assert.strictEqual(name, 'New Task.md');
    log(`PASS: 'New Task' -> '${name}'`);

    // Case B: Collision
    name = await getUniqueFilename(existing, 'Buy Milk');
    assert.strictEqual(name, 'Buy Milk (1).md');
    log(`PASS: 'Buy Milk' -> '${name}'`);

    // Case C: Sanitization
    name = await getUniqueFilename(existing, 'Buy/Sell');
    assert.strictEqual(name, 'Buy-Sell.md');
    log(`PASS: 'Buy/Sell' -> '${name}'`);

})();
