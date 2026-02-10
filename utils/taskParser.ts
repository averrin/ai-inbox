import { parseInlineProperties, serializeInlineProperties } from './propertyParser';

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

const TASK_REGEX = /^(\s*)([-*+])\s\[([ x\/\-\? >])\]\s+(.*)$/;
// const PROPERTY_REGEX = /\[([^:\]]+)::\s*([^\]]+)\]/g; // Deprecated by robust parser
const TAG_REGEX = /#([^\s#\[\]]+)/g;

/**
 * Parses a single line of markdown text into a RichTask object if it matches the task pattern.
 */
export function parseTaskLine(line: string): RichTask | null {
    const match = line.match(TASK_REGEX);
    if (!match) return null;

    const [, indentation, bullet, status, fullContent] = match;
    const completed = status === 'x';

    // 1. Extract Properties using robust parser
    const { properties, cleanedText } = parseInlineProperties(fullContent);

    // 2. Extract Tags from the remaining text (title + tags)
    // We use the cleanedText which has properties removed, to avoid extracting tags inside properties
    let title = cleanedText;
    const tags: string[] = [];

    const tagMatches = Array.from(title.matchAll(TAG_REGEX));
    const seenTags = new Set<string>();

    for (const m of tagMatches) {
        const tag = m[1];
        if (!seenTags.has(tag)) {
            tags.push(tag);
            seenTags.add(tag);
        }
        // Remove tag from title
        // We use replace with the exact match. Note: replace only replaces the first occurrence.
        // Since we iterate matchAll, we are fine, BUT if we have duplicates, we need to be careful.
        // If we have "Task #tag #tag", matchAll returns two matches.
        // First iteration removes first "#tag". Title becomes "Task  #tag".
        // Second iteration matches "#tag". Removes second "#tag". Title becomes "Task   ".
        // This works because matchAll finds indices in original string, but we are modifying 'title'.
        // Wait, matchAll indices are relative to 'cleanedText' (which is 'title' initially).
        // If we modify 'title', indices become invalid!
        // So we should NOT rely on indices, but simple replace is risky if order matters or if context changes.
        // However, standard approach is:
        title = title.replace(m[0], '');
    }

    // Clean up title (remove extra whitespace left by removals, but keep it minimal)
    title = title.replace(/\s+/g, ' ').trim();

    return {
        indentation,
        bullet,
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

    // Append properties using robust serializer
    content += serializeInlineProperties(task.properties);

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
