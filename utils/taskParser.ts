export interface RichTask {
    indentation: string;
    status: string; // ' ', 'x', '/', '-', '?', '>'
    completed: boolean;
    title: string;
    properties: Record<string, string>;
    tags: string[];
    originalLine: string;
}

const TASK_REGEX = /^(\s*)-\s\[([ x\/\-\? >])\]\s+(.*)$/;
const PROPERTY_REGEX = /\[([^:\]]+)::\s*([^\]]+)\]/g;
const TAG_REGEX = /#([^\s#\[\]]+)/g;

/**
 * Parses a single line of markdown text into a RichTask object if it matches the task pattern.
 */
export function parseTaskLine(line: string): RichTask | null {
    const match = line.match(TASK_REGEX);
    if (!match) return null;

    const [, indentation, status, fullContent] = match;
    const completed = status === 'x';

    let title = fullContent;
    const properties: Record<string, string> = {};
    const tags: string[] = [];

    // Extract properties [key:: value]
    let propMatch;
    const propertyMatches = Array.from(fullContent.matchAll(PROPERTY_REGEX));
    for (const m of propertyMatches) {
        properties[m[1].trim()] = m[2].trim();
        title = title.replace(m[0], '');
    }

    // Extract tags #tag
    const tagMatches = Array.from(fullContent.matchAll(TAG_REGEX));
    for (const m of tagMatches) {
        tags.push(m[1]);
        title = title.replace(m[0], '');
    }

    // Clean up title (remove extra whitespace left by removals, but keep it minimal)
    title = title.trim();

    return {
        indentation,
        status,
        completed,
        title,
        properties,
        tags,
        originalLine: line,
    };
}

/**
 * Serializes a RichTask object back into a markdown line.
 */
export function serializeTaskLine(task: RichTask): string {
    const status = task.status;
    let content = task.title.trim();

    // Append properties
    // Sort keys to ensure deterministic order? optional but good for stability
    const propKeys = Object.keys(task.properties).sort();
    propKeys.forEach(key => {
        content += ` [${key}:: ${task.properties[key]}]`;
    });

    // Append tags
    task.tags.forEach(tag => {
        content += ` #${tag}`;
    });

    return `${task.indentation}- [${status}] ${content}`;
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

    // 3. Try match by re-serializing the task (in case internal state is newer/cleaner than originalLine)
    const serialized = serializeTaskLine(task);
    index = lines.findIndex(l => l.trimEnd() === serialized.trimEnd());
    if (index !== -1) return index;

    // 4. Last resort: specific fuzzy match on Content + Status
    // This risks false positives if there are duplicate tasks, but it's better than failing to delete.
    // We match: same status AND same title (ignoring props/tags for a moment? No, include them)
    // Actually, let's strict match the meaningful parts.
    return lines.findIndex(l => {
        const parsed = parseTaskLine(l);
        if (!parsed) return false;
        // Compare essential logic
        return parsed.title === task.title
            && parsed.status === task.status
            && JSON.stringify(parsed.properties) === JSON.stringify(task.properties);
        // Tags might order differently, but let's assume they don't for now.
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
