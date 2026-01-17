import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system';

export async function requestVaultAccess() {
    try {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
            return permissions.directoryUri;
        }
        return null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function checkDirectoryExists(parentUri: string, dirName: string): Promise<string | null> {
    // Handle nested paths like "Inbox/URLs"
    if (dirName.includes('/')) {
        const parts = dirName.split('/').filter(p => p.trim());
        let currentUri = parentUri;

        for (const part of parts) {
            const found = await findSubdirectory(currentUri, part);
            if (!found) {
                console.log(`[checkDirectoryExists] Not found: ${dirName} (stopped at ${part})`);
                return null;
            }
            currentUri = found;
        }

        console.log(`[checkDirectoryExists] Found nested path: ${dirName}`);
        return currentUri;
    }

    // Single folder name
    return findSubdirectory(parentUri, dirName);
}

export async function readVaultStructure(vaultUri: string, maxDepth: number = 2): Promise<string> {
    try {
        const structure: string[] = [];

        async function readDir(uri: string, depth: number, prefix: string = ''): Promise<void> {
            if (depth > maxDepth) return;

            try {
                const children = await StorageAccessFramework.readDirectoryAsync(uri);

                for (const childUri of children) {
                    const decoded = decodeURIComponent(childUri);
                    const parts = decoded.split('/');
                    const lastPart = parts[parts.length - 1];
                    const name = lastPart.includes(':') ? lastPart.split(':').pop()! : lastPart;

                    // Check if it's a directory by trying to read it
                    try {
                        await StorageAccessFramework.readDirectoryAsync(childUri);
                        structure.push(`${prefix}📁 ${name}/`);
                        if (depth < maxDepth) {
                            await readDir(childUri, depth + 1, prefix + '  ');
                        }
                    } catch {
                        // It's a file - check if it's a markdown file
                        if (name.endsWith('.md')) {
                            try {
                                const content = await StorageAccessFramework.readAsStringAsync(childUri);
                                // Parse frontmatter to extract metadata
                                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                                let metadata = '';
                                if (frontmatterMatch) {
                                    const fm = frontmatterMatch[1];
                                    const iconMatch = fm.match(/icon:\s*["']?([^"'\n]+)["']?/);
                                    const tagsMatch = fm.match(/tags:\s*\[([^\]]+)\]/);

                                    if (iconMatch) metadata += iconMatch[1] + ' ';
                                    metadata += name.replace('.md', '');
                                    if (tagsMatch) {
                                        const tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
                                        metadata += ` [${tags.join(', ')}]`;
                                    }
                                } else {
                                    metadata = name.replace('.md', '');
                                }
                                structure.push(`${prefix}📄 ${metadata}`);
                            } catch (e) {
                                // If can't read file, just show name
                                structure.push(`${prefix}📄 ${name.replace('.md', '')}`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn(`Error reading directory at depth ${depth}:`, e);
            }
        }

        structure.push('📁 Vault/');
        await readDir(vaultUri, 0, '  ');

        return structure.join('\n');
    } catch (e) {
        console.error("Error reading vault structure:", e);
        return "Could not read vault structure";
    }
}

async function findSubdirectory(parentUri: string, dirName: string): Promise<string | null> {
    try {
        const children = await StorageAccessFramework.readDirectoryAsync(parentUri);
        const targetName = dirName.toLowerCase();

        for (const uri of children) {
            // SAF URIs are encoded. 
            const decoded = decodeURIComponent(uri);

            // Check strict suffix match OR manual parse
            if (decoded.toLowerCase().endsWith(`/${targetName}`) || decoded.toLowerCase().endsWith(`:${targetName}`)) {
                console.log(`[findSubdirectory] Found by suffix: ${decoded}`);
                return uri;
            }

            // Manual extraction
            const parts = decoded.split('/');
            const last = parts[parts.length - 1];
            let folderName = last.includes(':') ? last.split(':').pop() : last;

            if (folderName?.toLowerCase() === targetName) {
                console.log(`[findSubdirectory] Found by manual parse: ${decoded}`);
                return uri;
            }
        }

        console.warn(`[findSubdirectory] Not found: ${dirName}`);
        return null;
    } catch (e) {
        console.error(`[findSubdirectory] Error searching for ${dirName}:`, e);
        return null;
    }
}

export async function ensureDirectory(parentUri: string, dirName: string): Promise<string> {
    const existing = await findSubdirectory(parentUri, dirName);
    if (existing) {
        console.log(`[ensureDirectory] Directory exists: ${dirName}`);
        return existing;
    }

    console.log(`[ensureDirectory] Creating directory: ${dirName}`);
    try {
        const newUri = await StorageAccessFramework.makeDirectoryAsync(parentUri, dirName);
        console.log(`[ensureDirectory] Created: ${newUri}`);
        return newUri;
    } catch (e: any) {
        // Race condition: check if it exists now
        const recheck = await findSubdirectory(parentUri, dirName);
        if (recheck) {
            console.log(`[ensureDirectory] Directory created by another process: ${dirName}`);
            return recheck;
        }
        console.error(`[ensureDirectory] Failed to create ${dirName}:`, e);
        throw e;
    }
}

export async function saveToVault(vaultUri: string, filename: string, content: string, folderPath?: string): Promise<string> {
    try {
        let targetUri = vaultUri;

        if (folderPath && folderPath.trim()) {
            const parts = folderPath.split('/').filter(p => p.trim());
            for (const part of parts) {
                targetUri = await ensureDirectory(targetUri, part);
            }
        }

        const fileUri = await StorageAccessFramework.createFileAsync(targetUri, filename, 'text/markdown');
        await StorageAccessFramework.writeAsStringAsync(fileUri, content);
        console.log(`[saveToVault] Successfully saved: ${fileUri}`);
        return fileUri;
    } catch (e) {
        console.error('[saveToVault] Error:', e);
        throw e;
    }
}
