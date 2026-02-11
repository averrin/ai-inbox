
export interface LinkMetadata {
    title: string;
    url: string;
    description?: string;
    image?: string;
    favicon?: string;
}

export interface LinkWithSource extends LinkMetadata {
    filePath: string;
    fileName: string;
    fileUri: string;
    tags: string[];
    blockStartLine: number;
    blockEndLine: number;
}

/**
 * Parses file content to extract frontmatter tags and embed blocks.
 */
export function parseLinksFromContent(content: string, filePath: string, fileName: string, fileUri: string): LinkWithSource[] {
    const lines = content.split('\n');
    const links: LinkWithSource[] = [];
    let tags: string[] = [];

    // 1. Parse Frontmatter for tags
    if (lines.length > 0 && lines[0].trim() === '---') {
        let i = 1;
        while (i < lines.length && lines[i].trim() !== '---') {
            const line = lines[i];
            if (line.startsWith('tags:')) {
                const match = line.match(/tags:\s*\[(.*?)\]/);
                if (match) {
                    tags = match[1].split(',').map(t => t.trim()).filter(t => t);
                }
            }
            i++;
        }
    }

    // 2. Parse Embed Blocks
    let insideEmbed = false;
    let currentLink: Partial<LinkMetadata> = {};
    let startLine = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('```embed')) {
            insideEmbed = true;
            currentLink = {};
            startLine = i;
            continue;
        }

        if (insideEmbed) {
            if (line === '```') {
                // End of block
                if (currentLink.url) { // URL is required
                     links.push({
                        title: currentLink.title || currentLink.url || 'Untitled',
                        url: currentLink.url!,
                        description: currentLink.description,
                        image: currentLink.image,
                        favicon: currentLink.favicon,
                        filePath,
                        fileName,
                        fileUri,
                        tags: [...tags], // Copy file tags
                        blockStartLine: startLine,
                        blockEndLine: i,
                    });
                }
                insideEmbed = false;
            } else {
                // Parse Key-Value
                // Format: key: "value"
                // Match key followed by optional colon, spaces, quote, value, quote
                const match = line.match(/^(\w+):\s*"(.*)"$/);
                if (match) {
                    const key = match[1];
                    const value = match[2];
                    if (key === 'title') currentLink.title = value;
                    else if (key === 'url') currentLink.url = value;
                    else if (key === 'image') currentLink.image = value;
                    else if (key === 'description') currentLink.description = value;
                    else if (key === 'favicon') currentLink.favicon = value;
                }
            }
        }
    }

    return links;
}
