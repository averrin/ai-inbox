export interface Frontmatter {
    [key: string]: any;
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; content: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) {
        return { frontmatter: {}, content: content.trim() };
    }

    const frontmatterRaw = match[1];
    const body = content.slice(match[0].length).trim();
    const frontmatter: Frontmatter = {};

    const lines = frontmatterRaw.split('\n');
    for (const line of lines) {
        // Simple key-value parsing
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            let value = parts.slice(1).join(':').trim();

            // Remove quotes if they exist around the whole value
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

            // Handle basic arrays (simple [a, b] format)
            if (value.startsWith('[') && value.endsWith(']')) {
                 const arrayContent = value.slice(1, -1);
                 if (arrayContent.trim() === '') {
                     frontmatter[key] = [];
                 } else {
                     frontmatter[key] = arrayContent.split(',').map(s => {
                         const trimmed = s.trim();
                         // Remove quotes from array elements
                         if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                             return trimmed.slice(1, -1);
                         }
                         return trimmed;
                     });
                 }
            } else {
                frontmatter[key] = value;
            }
        }
    }

    return { frontmatter, content: body };
}

export function updateFrontmatter(content: string, updates: Record<string, string | number | boolean | null | undefined>): string {
    const { frontmatter, content: body } = parseFrontmatter(content);

    // Apply updates
    Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            delete frontmatter[key];
        } else {
            frontmatter[key] = value;
        }
    });

    if (Object.keys(frontmatter).length === 0) {
        return body;
    }

    const frontmatterString = Object.entries(frontmatter)
        .map(([key, value]) => {
            if (Array.isArray(value)) {
                return `${key}: [${value.join(', ')}]`;
            }
            return `${key}: ${value}`;
        })
        .join('\n');

    return `---\n${frontmatterString}\n---\n${body}`;
}
