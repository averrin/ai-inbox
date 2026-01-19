import { StorageAccessFramework } from 'expo-file-system/legacy';
import { checkDirectoryExists } from './saf';

/**
 * Scans the specified folder (shallow or limited depth) for tags.
 * Returns top 5 most used tags.
 */
export async function getMostUsedTags(vaultUri: string, contextFolder: string | null | undefined): Promise<string[]> {
    try {
        console.log('[TagScanner] Starting scan...');
        console.log('[TagScanner] Context folder:', contextFolder);

        let baseUri = vaultUri;
        if (contextFolder) {
            const folderUri = await checkDirectoryExists(vaultUri, contextFolder);
            if (folderUri) {
                baseUri = folderUri;
                console.log('[TagScanner] Using context folder URI');
            } else {
                console.log('[TagScanner] Context folder not found, falling back to root');
            }
        }

        // Recursively find all MD files
        const mdFiles: string[] = [];

        async function scanDirectory(uri: string, depth: number = 0): Promise<void> {
            if (depth > 5) return; // Safety limit

            try {
                const children = await StorageAccessFramework.readDirectoryAsync(uri);

                for (const childUri of children) {
                    const decoded = decodeURIComponent(childUri);

                    if (decoded.endsWith('.md')) {
                        mdFiles.push(childUri);
                    } else {
                        // Try to read as directory (if it fails, it's a file)
                        try {
                            await StorageAccessFramework.readDirectoryAsync(childUri);
                            // It's a directory, recurse into it
                            await scanDirectory(childUri, depth + 1);
                        } catch {
                            // Not a directory, skip
                        }
                    }
                }
            } catch (e) {
                console.warn('[TagScanner] Failed to read directory at depth', depth, e);
            }
        }

        await scanDirectory(baseUri);

        // Limit to 50 files to manage performance (increased from 20 since we're scanning recursively)
        const filesToScan = mdFiles.slice(0, 50);

        const tagCounts: Record<string, number> = {};

        for (const fileUri of filesToScan) {
            try {
                const fileName = decodeURIComponent(fileUri).split('/').pop() || 'unknown';
                const content = await StorageAccessFramework.readAsStringAsync(fileUri);
                const fileTags: string[] = [];

                // 1. Extract Frontmatter tags
                // Use [\r\n] to handle both Windows and Unix line endings
                const frontmatterMatch = content.match(/^---[\r\n]+([\s\S]*?)[\r\n]+---/);
                if (frontmatterMatch) {
                    const fm = frontmatterMatch[1];

                    // Check if tags are in list format (YAML list with '- ' prefix)
                    const listFormatMatch = fm.match(/tags:\s*[\r\n]+((?:\s*-\s*[^\r\n]+[\r\n]*)+)/);
                    if (listFormatMatch) {
                        // Parse YAML list format: tags:\n  - tag1\n  - tag2
                        const listContent = listFormatMatch[1];
                        const tags = listContent
                            .split(/[\r\n]+/)
                            .map(line => line.trim())
                            .filter(line => line.startsWith('-'))
                            .map(line => line.substring(1).trim().replace(/['"\[\]]/g, ''))
                            .filter(tag => tag.length > 0);

                        tags.forEach(tag => {
                            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                            fileTags.push(tag);
                        });
                    } else {
                        // Try bracket or comma-separated format: tags: [tag1, tag2] or tags: tag1, tag2
                        const tagsMatch = fm.match(/tags:\s*(?:\[([^\]]+)\]|([^\r\n]+))/);
                        if (tagsMatch) {
                            const tagsStr = tagsMatch[1] || tagsMatch[2];
                            if (tagsStr) {
                                const tags = tagsStr.split(',').map(t => t.trim().replace(/['"\[\]]/g, ''));
                                tags.forEach(tag => {
                                    if (tag) {
                                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                                        fileTags.push(tag);
                                    }
                                });
                            }
                        }
                    }
                }

                // 2. Extract Body tags (#tag)
                // Improved regex to catch more hashtag patterns
                const bodyMatches = content.matchAll(/(^|\s)#([a-zA-Z0-9][a-zA-Z0-9-_]*)/gm);
                for (const match of bodyMatches) {
                    const tag = match[2]; // Group 2 is the tag without #
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                    if (!fileTags.includes(tag)) fileTags.push(tag);
                }


            } catch (e) {
                console.warn('[TagScanner] Failed to read file:', e);
            }
        }


        // Sort by count desc
        const sortedTags = Object.entries(tagCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([tag]) => tag)
            .slice(0, 5);

        return sortedTags;

    } catch (e) {
        console.error('[TagScanner] Error:', e);
        return [];
    }
}
