import { StorageAccessFramework } from 'expo-file-system/legacy';
import { checkDirectoryExists, writeSafe } from '../utils/saf';
import { parseLinksFromContent, LinkWithSource } from '../utils/linkParser';

export { LinkWithSource }; // Re-export for convenience

export interface FolderGroup {
    name: string;
    path: string;
    uri: string;
}

export class LinkService {
    /**
     * Scans the links root for subfolders.
     */
    static async getFolderGroups(vaultUri: string, linksRoot: string): Promise<FolderGroup[]> {
        if (!linksRoot) return [];

        const rootUri = await checkDirectoryExists(vaultUri, linksRoot);
        if (!rootUri) return [];

        try {
            const children = await StorageAccessFramework.readDirectoryAsync(rootUri);
            const groups: FolderGroup[] = [];

            for (const uri of children) {
                const decoded = decodeURIComponent(uri);
                const parts = decoded.split('/');
                const lastPart = parts[parts.length - 1];
                const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;

                // Try reading as dir to confirm it's a folder
                try {
                    await StorageAccessFramework.readDirectoryAsync(uri);
                    groups.push({
                        name,
                        path: `${linksRoot}/${name}`,
                        uri,
                    });
                } catch {
                    // Not a directory, skip
                }
            }

            return groups;
        } catch (e) {
            console.error('[LinkService] Failed to get folder groups', e);
            return [];
        }
    }

    /**
     * Scans a folder (and subfolders) for all links in .md files.
     */
    static async scanLinksInFolder(folderUri: string, folderPath: string): Promise<LinkWithSource[]> {
        const links: LinkWithSource[] = [];

        async function walk(uri: string, path: string) {
            const children = await StorageAccessFramework.readDirectoryAsync(uri);

            for (const childUri of children) {
                const decoded = decodeURIComponent(childUri);
                const parts = decoded.split('/');
                const lastPart = parts[parts.length - 1];
                const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;

                try {
                    // Recurse if directory
                    const subChildren = await StorageAccessFramework.readDirectoryAsync(childUri);
                    await walk(childUri, `${path}/${name}`);
                } catch {
                    // It's a file
                    if (name.endsWith('.md')) {
                        try {
                            const content = await StorageAccessFramework.readAsStringAsync(childUri);
                            const fileLinks = parseLinksFromContent(content, `${path}/${name}`, name, childUri);
                            links.push(...fileLinks);
                        } catch (e) {
                            console.warn(`[LinkService] Failed to read ${name}`, e);
                        }
                    }
                }
            }
        }

        await walk(folderUri, folderPath);
        return links;
    }

    /**
     * Deletes a link (embed block) from its source file.
     */
    static async deleteLink(vaultUri: string, link: LinkWithSource): Promise<void> {
        try {
            const content = await StorageAccessFramework.readAsStringAsync(link.fileUri);
            const lines = content.split('\n');

            // Verify lines match (simple check)
            if (lines[link.blockStartLine]?.trim().startsWith('```embed') && lines[link.blockEndLine]?.trim() === '```') {
                // Remove lines inclusive
                lines.splice(link.blockStartLine, link.blockEndLine - link.blockStartLine + 1);
                const newContent = lines.join('\n');
                await writeSafe(link.fileUri, newContent);
            } else {
                console.warn('[LinkService] File content changed, cannot safely delete link');
                // Could retry scan here, but for now just warn
            }
        } catch (e) {
            console.error(`[LinkService] Failed to delete link ${link.title}`, e);
            throw e;
        }
    }
}
