/**
 * Preprocesses markdown text to convert ```embed blocks into a format
 * that can be styled differently by the markdown renderer
 */
export function preprocessMarkdownEmbeds(text: string): string {
    // Convert ```embed blocks to blockquotes with a special prefix
    // This allows them to be styled as callouts via the blockquote style
    const embedBlockRegex = /```embed\n([\s\S]*?)```/g;

    return text.replace(embedBlockRegex, (match, content) => {
        // Convert to a blockquote with special marker
        const lines = content.trim().split('\n');
        const quotedLines = lines.map((line: string) => `> 📦 ${line}`).join('\n');
        return quotedLines;
    });
}

/**
 * Postprocesses markdown text to restore ```embed blocks from blockquote format
 * (for when user wants to see/edit the raw markdown)
 */
export function postprocessMarkdownEmbeds(text: string): string {
    // Convert special blockquotes back to ```embed blocks
    const embedQuoteRegex = /(?:^> 📦 .*\n?)+/gm;

    return text.replace(embedQuoteRegex, (match) => {
        const lines = match
            .split('\n')
            .filter(l => l.trim())
            .map(line => line.replace(/^> 📦 /, ''));
        return `\`\`\`embed\n${lines.join('\n')}\n\`\`\``;
    });
}
