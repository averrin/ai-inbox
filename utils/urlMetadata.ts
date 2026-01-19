/**
 * URL metadata extraction and Obsidian embed generation
 */

export interface URLMetadata {
    url: string;
    title: string;
    description?: string;
    image?: string;
    favicon?: string;
}

/**
 * Extract URLs from text
 */
export function extractURLs(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<]+/g;
    const matches = text.match(urlRegex);
    return matches || [];
}

/**
 * Fetch metadata from a URL
 */
export async function fetchURLMetadata(url: string): Promise<URLMetadata> {
    try {
        console.log('[URLMetadata] Fetching:', url);

        // Special handling for YouTube
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const response = await fetch(oembedUrl);
                if (response.ok) {
                    const data = await response.json();
                    return {
                        url,
                        title: data.title || 'YouTube Video',
                        description: data.author_name ? `by ${data.author_name}` : undefined,
                        image: data.thumbnail_url,
                        favicon: 'https://www.youtube.com/favicon.ico',
                    };
                }
            } catch (e) {
                console.warn('[URLMetadata] YouTube oembed failed:', e);
            }
        }

        // Fetch HTML
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ObsidianMobile/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // Extract metadata from HTML
        const metadata: URLMetadata = { url, title: url };

        // Title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            metadata.title = titleMatch[1].trim();
        }

        // OpenGraph / Twitter Card metadata
        const ogTitleMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i);
        if (ogTitleMatch) {
            metadata.title = ogTitleMatch[1].trim();
        }

        const ogDescMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:description|twitter:description|description)["']\s+content=["']([^"']+)["']/i);
        if (ogDescMatch) {
            metadata.description = ogDescMatch[1].trim();
        }

        const ogImageMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
        if (ogImageMatch) {
            metadata.image = ogImageMatch[1].trim();
        }

        // Favicon
        const faviconMatch = html.match(/<link\s+[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
        if (faviconMatch) {
            let faviconUrl = faviconMatch[1];
            // Make absolute if relative
            if (faviconUrl.startsWith('/')) {
                const urlObj = new URL(url);
                faviconUrl = `${urlObj.protocol}//${urlObj.host}${faviconUrl}`;
            }
            metadata.favicon = faviconUrl;
        } else {
            // Default favicon
            const urlObj = new URL(url);
            metadata.favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
        }

        console.log('[URLMetadata] Extracted:', metadata);
        return metadata;

    } catch (e) {
        console.error('[URLMetadata] Failed to fetch metadata:', e);
        // Return basic metadata
        return {
            url,
            title: url,
        };
    }
}

/**
 * Build Obsidian embed code block from metadata
 */
export function buildObsidianEmbed(metadata: URLMetadata): string {
    const lines = [`\`\`\`embed`];

    lines.push(`title: "${metadata.title}"`);

    if (metadata.image) {
        lines.push(`image: "${metadata.image}"`);
    }

    if (metadata.description) {
        lines.push(`description: "${metadata.description}"`);
    }

    lines.push(`url: "${metadata.url}"`);

    if (metadata.favicon) {
        lines.push(`favicon: "${metadata.favicon}"`);
    }

    lines.push(`\`\`\``);

    return lines.join('\n');
}

/**
 * Process URLs in text: extract, fetch metadata, build embeds
 * Returns embeds and clean text (with URLs removed)
 */
export async function processURLsInText(text: string): Promise<{ embeds: string; cleanText: string; metadata?: URLMetadata[] }> {
    const urls = extractURLs(text);

    if (urls.length === 0) {
        return { embeds: '', cleanText: text };
    }

    console.log('[URLMetadata] Found URLs:', urls);

    // Fetch metadata for all URLs
    const metadataPromises = urls.map(url => fetchURLMetadata(url));
    const metadataList = await Promise.all(metadataPromises);

    // Build embeds
    const embedBlocks = metadataList.map(metadata => buildObsidianEmbed(metadata));
    const embeds = embedBlocks.join('\n\n');

    // Remove URLs from text to avoid duplication
    let cleanText = text;
    urls.forEach(url => {
        cleanText = cleanText.replace(url, '');
    });

    // Clean up extra whitespace
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return { embeds, cleanText, metadata: metadataList };
}
