import { TextStyle, Text, StyleSheet } from 'react-native';

export type MarkdownChunk = {
    text: string;
    style?: TextStyle;
    key: string;
};

// Define styles
const styles = {
    h1: { fontSize: 24, fontWeight: 'bold' as const, color: '#e2e8f0', lineHeight: 32 },
    h2: { fontSize: 20, fontWeight: 'bold' as const, color: '#e2e8f0', lineHeight: 28 },
    h3: { fontSize: 18, fontWeight: 'bold' as const, color: '#e2e8f0', lineHeight: 26 },
    bold: { fontWeight: 'bold' as const, color: '#fbbf24' }, // Amber-400
    italic: { fontStyle: 'italic' as const, color: '#94a3b8' },
    code: { fontFamily: 'monospace', backgroundColor: '#334155', color: '#e2e8f0' },
    codeBlock: { fontFamily: 'monospace', color: '#f8fafc' },
    quote: { color: '#94a3b8', fontStyle: 'italic' as const },
    link: { color: '#60a5fa', textDecorationLine: 'underline' as const },
    normal: { color: '#ffffff', fontSize: 16, lineHeight: 24 }, // Base text style matching input
};

export function parseMarkdown(text: string): MarkdownChunk[] {
    const lines = text.split('\n');
    let chunks: MarkdownChunk[] = [];
    let keyCounter = 0;

    lines.forEach((line, index) => {
        const isLastLine = index === lines.length - 1;
        const lineWithNewline = line + (isLastLine ? '' : '\n');

        // Block-level parsing
        if (line.startsWith('# ')) {
            chunks.push({ text: lineWithNewline, style: { ...styles.normal, ...styles.h1 }, key: `h1-${keyCounter++}` });
        } else if (line.startsWith('## ')) {
            chunks.push({ text: lineWithNewline, style: { ...styles.normal, ...styles.h2 }, key: `h2-${keyCounter++}` });
        } else if (line.startsWith('### ')) {
            chunks.push({ text: lineWithNewline, style: { ...styles.normal, ...styles.h3 }, key: `h3-${keyCounter++}` });
        } else if (line.startsWith('> ')) {
            chunks.push({ text: lineWithNewline, style: { ...styles.normal, ...styles.quote }, key: `qt-${keyCounter++}` });
        } else {
            // Inline parsing for normal lines (and others if we supported recursive)
            // For now, only process inline on non-headed lines to avoid mess, or process all?
            // Process basic inline on normal text
            const inlineChunks = parseInline(lineWithNewline, keyCounter);
            keyCounter += inlineChunks.length;
            chunks.push(...inlineChunks);
        }
    });

    return chunks;
}

function parseInline(text: string, startKey: number): MarkdownChunk[] {
    // Simple parser: Split by tokens and match
    // Order: Code -> Bold -> Italic -> Link
    // To keep it simple and performant, we'll use a split approach or simple replacements
    // But splitting is hard with overlapping.
    // Let's do a simple regex match for one type at a time? No, need linear scan.

    // We will do a very naive split by Code, then Bold.

    // 1. Code `...`
    const parts: MarkdownChunk[] = [];
    const codeRegex = /(`[^`]+`)/g;

    let lastIndex = 0;
    let match;

    // Loop through code matches
    while ((match = codeRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(...processBold(text.substring(lastIndex, match.index), startKey + parts.length));
        }
        parts.push({ text: match[0], style: { ...styles.normal, ...styles.code }, key: `code-${startKey + parts.length}` });
        lastIndex = codeRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(...processBold(text.substring(lastIndex), startKey + parts.length));
    }

    return parts;
}

function processBold(text: string, startKey: number): MarkdownChunk[] {
    const parts: MarkdownChunk[] = [];
    const boldRegex = /(\*\*[^*]+\*\*)/g; // Naive bold

    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(...processItalic(text.substring(lastIndex, match.index), startKey + parts.length));
        }
        parts.push({ text: match[0], style: { ...styles.normal, ...styles.bold }, key: `bold-${startKey + parts.length}` });
        lastIndex = boldRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push(...processItalic(text.substring(lastIndex), startKey + parts.length));
    }

    return parts;
}

function processItalic(text: string, startKey: number): MarkdownChunk[] {
    const parts: MarkdownChunk[] = [];
    const italicRegex = /(_[^_]+_|\*[^*]+\*)/g; // * or _

    let lastIndex = 0;
    let match;

    while ((match = italicRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ text: text.substring(lastIndex, match.index), style: styles.normal, key: `norm-${startKey + parts.length}` });
        }
        parts.push({ text: match[0], style: { ...styles.normal, ...styles.italic }, key: `italic-${startKey + parts.length}` });
        lastIndex = italicRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push({ text: text.substring(lastIndex), style: styles.normal, key: `norm-${startKey + parts.length}` });
    }

    return parts;
}
