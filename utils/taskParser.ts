export interface RichTask {
    indentation: string;
    completed: boolean;
    title: string;
    properties: Record<string, string>;
    tags: string[];
    originalLine: string;
}

const TASK_REGEX = /^(\s*)-\s\[([ x])\]\s+(.*)$/;
const PROPERTY_REGEX = /\[([\w-]+)::\s*([^\]]+)\]/g;
const TAG_REGEX = /#([\w-]+)/g;

/**
 * Parses a single line of markdown text into a RichTask object if it matches the task pattern.
 */
export function parseTaskLine(line: string): RichTask | null {
    const match = line.match(TASK_REGEX);
    if (!match) return null;

    const [, indentation, statusChar, fullContent] = match;
    const completed = statusChar === 'x';

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

    // Clean up title (remove extra whitespace left by removals)
    title = title.trim().replace(/\s+/g, ' ');

    return {
        indentation,
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
    const status = task.completed ? 'x' : ' ';
    let content = task.title;

    // Append properties
    Object.entries(task.properties).forEach(([key, value]) => {
        content += ` [${key}:: ${value}]`;
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
 * Replaces a specific task line in the original text with a new serialized version.
 */
export function updateTaskInText(originalText: string, oldTask: RichTask, newTask: RichTask): string {
    const lines = originalText.split('\n');
    const oldLine = oldTask.originalLine;
    const newLine = serializeTaskLine(newTask);

    const index = lines.indexOf(oldLine);
    if (index !== -1) {
        lines[index] = newLine;
    }

    return lines.join('\n');
}

/**
 * Removes a specific task line from the original text.
 */
export function removeTaskFromText(originalText: string, task: RichTask): string {
    const lines = originalText.split('\n');
    const oldLine = task.originalLine;

    const index = lines.indexOf(oldLine);
    if (index !== -1) {
        lines.splice(index, 1);
    }

    return lines.join('\n');
}
