export interface RichTask {
    indentation: string;
    bullet: string; // '-', '*', '+'
    status: string; // ' ', 'x', '/', '-', '?', '>'
    completed: boolean;
    title: string;
    properties: Record<string, string>;
    tags: string[];
    originalLine: string;
}

const TASK_REGEX_START = /^(\s*)([-*+])\s\[([ x\/\-\? >])\]\s+/;
const TAG_REGEX = /#([^\s#\[\]]+)/g;

/**
 * Parses a single line of markdown text into a RichTask object if it matches the task pattern.
 * Uses a stateful parser to correctly handle nested brackets in properties.
 */
export function parseTaskLine(line: string): RichTask | null {
    const match = line.match(TASK_REGEX_START);
    if (!match) return null;

    const [, indentation, bullet, status] = match;
    const completed = status === 'x';
    const contentStartIndex = match[0].length;
    let fullContent = line.substring(contentStartIndex);

    // --- Stateful Parser for Properties & Logic ---
    let title = '';
    const properties: Record<string, string> = {};
    const tags: string[] = [];

    // We will iterate through fullContent and build 'title' while extracting properties
    let i = 0;
    while (i < fullContent.length) {
        const char = fullContent[i];

        // Potential start of a property: '['
        if (char === '[') {
            const closingIndex = findBalancedClosingBracket(fullContent, i);
            if (closingIndex !== -1) {
                // We have a balanced bracket group: [ ... ]
                // Check if it matches [key:: value]
                const innerResult = parsePropertyContent(fullContent.substring(i + 1, closingIndex));
                if (innerResult) {
                    // It IS a property
                    properties[innerResult.key] = innerResult.value;
                    i = closingIndex + 1; // Skip this block
                    continue;
                }
            }
        }

        // Potential tag: '#'
        // We defer tag extraction to a regex pass on the *remaining* title or check here?
        // Checking here allows avoiding tags inside other things, but tags usually aren't bracketed.
        // Let's stick to standard behavior: Extract properties first, then what's left is title + tags.

        title += char;
        i++;
    }

    // --- Post-Processing Title ---

    // Now extract tags from the constructed title (which has properties removed)
    // We want to remove tags from the title too, usually.
    const titleWithoutTags = title.replace(TAG_REGEX, (match, tagName) => {
        tags.push(tagName);
        return ''; // Remove tag from title
    });

    // Clean up title (trim extra whitespace from removals)
    title = titleWithoutTags.trim();
    // also remove double spaces if any were left by removing things in middle
    title = title.replace(/\s{2,}/g, ' ');

    return {
        indentation,
        bullet,
        status,
        completed,
        title,
        properties,
        tags: Array.from(new Set(tags)), // Dedup
        originalLine: line,
    };
}

/**
 * Finds the index of the matching closing bracket ']', handling nested brackets.
 * Returns -1 if not found.
 */
function findBalancedClosingBracket(text: string, startIndex: number): number {
    let depth = 0;
    for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '[') {
            depth++;
        } else if (text[i] === ']') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Checks if the content inside [...] looks like "key:: value".
 * Returns {key, value} if yes, null otherwise.
 */
function parsePropertyContent(content: string): { key: string, value: string } | null {
    // We look for the FIRST "::" that isn't inside nested brackets?
    // Actually properties usually don't have nested brackets in the KEY.
    // The VALUE might have them: [key:: [link](url)]

    const separatorIndex = content.indexOf('::');
    if (separatorIndex === -1) return null;

    const key = content.substring(0, separatorIndex).trim();
    const value = content.substring(separatorIndex + 2).trim();

    // Key validation: standard keys don't have spaces or weird chars usually, 
    // but Obsidian is flexible. 
    // However, [Link](url) shouldn't be parsed as key='Link](url', val='...'. 
    // Wait, [Link](url) doesn't have '::'.
    // What if someone writes [Link::Url](description)? 
    // Valid property.

    // If the key contains `[`, it might be invalid? 
    // Obsidian keys are usually simple strings.
    // Let's assume if it has '::', it's a property.

    return { key, value };
}

/**
 * Serializes a RichTask object back into a markdown line.
 */
export function serializeTaskLine(task: RichTask): string {
    const status = task.status;
    let content = task.title.trim();

    // Append properties
    // Sort keys to ensure deterministic order
    const propKeys = Object.keys(task.properties).sort();
    propKeys.forEach(key => {
        const value = task.properties[key];
        content += ` [${key}:: ${value}]`;
    });

    // Append tags
    task.tags.forEach(tag => {
        content += ` #${tag}`;
    });

    return `${task.indentation}${task.bullet || '-'} [${status}] ${content}`;
}

/**
 * Finds all task items in a block of text.
 */
export function findTasks(text: string): RichTask[] {
    return text.split('\n')
        .map(line => parseTaskLine(line))
        .filter((task): task is RichTask => task !== null);
}

/**
 * Helper to find a task line index robustly.
 */
function findTaskLineIndex(lines: string[], task: RichTask): number {
    // 1. Try exact match of originalLine
    let index = lines.findIndex(l => l === task.originalLine);
    if (index !== -1) return index;

    // 2. Try match ignoring trailing whitespace (CRLF vs LF issues)
    const originalTrimmed = task.originalLine.trimEnd();
    index = lines.findIndex(l => l.trimEnd() === originalTrimmed);
    if (index !== -1) return index;

    // 3. Try match by re-serializing the task
    const serialized = serializeTaskLine(task);
    index = lines.findIndex(l => l.trimEnd() === serialized.trimEnd());
    if (index !== -1) return index;

    // 4. Last resort: specific fuzzy match on distinct fields
    return lines.findIndex(l => {
        const parsed = parseTaskLine(l);
        if (!parsed) return false;

        // Match title and status strictly
        if (parsed.title !== task.title) return false;
        if (parsed.status !== task.status) return false;

        // Match property keys match (values might change? no, we want identity)
        const keysA = Object.keys(parsed.properties).sort().join(',');
        const keysB = Object.keys(task.properties).sort().join(',');
        if (keysA !== keysB) return false;

        return true;
    });
}

/**
 * Replaces a specific task line in the original text with a new serialized version.
 */
export function updateTaskInText(originalText: string, oldTask: RichTask, newTask: RichTask): string {
    const lines = originalText.split('\n');
    const newLine = serializeTaskLine(newTask);

    const index = findTaskLineIndex(lines, oldTask);

    if (index !== -1) {
        // preserve the original line ending style if possible
        const originalLine = lines[index];
        const hasCR = originalLine.endsWith('\r');
        lines[index] = newLine + (hasCR ? '\r' : '');
    } else {
        console.warn('[taskParser] Could not find task line to update:', oldTask.originalLine);
    }

    return lines.join('\n');
}

/**
 * Removes a specific task line from the original text.
 */
export function removeTaskFromText(originalText: string, task: RichTask): string {
    const lines = originalText.split('\n');
    const index = findTaskLineIndex(lines, task);

    if (index !== -1) {
        lines.splice(index, 1);
    } else {
        console.warn('[taskParser] Could not find task line to remove:', task.originalLine);
    }

    return lines.join('\n');
}
