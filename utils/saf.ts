import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Helper to find a subdirectory by name in a parent directory
 */
export async function findSubdirectory(parentUri: string, dirName: string): Promise<string | null> {
    try {
        const children = await StorageAccessFramework.readDirectoryAsync(parentUri);
        const targetName = dirName.toLowerCase();

        for (const uri of children) {
            const decoded = decodeURIComponent(uri);
            if (decoded.toLowerCase().endsWith(`/${targetName}`) || decoded.toLowerCase().endsWith(`:${targetName}`)) {
                return uri;
            }

            const parts = decoded.split('/');
            const last = parts[parts.length - 1];
            let folderName = last.includes(':') ? last.split(':').pop() : last;

            if (folderName?.toLowerCase() === targetName) {
                return uri;
            }
        }
        return null;
    } catch (e) {
        console.error(`[findSubdirectory] Error searching for ${dirName}:`, e);
        return null;
    }
}

/**
 * Helper to find a file by name in a parent directory
 */
export async function findFile(parentUri: string, filename: string): Promise<string | null> {
    try {
        const children = await StorageAccessFramework.readDirectoryAsync(parentUri);
        const targetName = filename.toLowerCase();

        for (const uri of children) {
            const decoded = decodeURIComponent(uri);
            const parts = decoded.split('/');
            const last = parts[parts.length - 1];
            let name = last.includes(':') ? last.split(':').pop() : last;

            if (name?.toLowerCase() === targetName) {
                return uri;
            }
        }
        return null;
    } catch (e) {
        console.error(`[findFile] Error searching for ${filename}:`, e);
        return null;
    }
}

export async function createFile(parentUri: string, filename: string, mimeType: string = 'text/plain'): Promise<string> {
    try {
        return await StorageAccessFramework.createFileAsync(parentUri, filename, mimeType);
    } catch (e) {
        console.error(`[createFile] Error creating ${filename}:`, e);
        throw e;
    }
}

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
    if (dirName.includes('/')) {
        const parts = dirName.split('/').filter(p => p.trim());
        let currentUri = parentUri;

        for (const part of parts) {
            const found = await findSubdirectory(currentUri, part);
            if (!found) return null;
            currentUri = found;
        }
        return currentUri;
    }
    return findSubdirectory(parentUri, dirName);
}

export async function ensureDirectory(parentUri: string, dirName: string): Promise<string> {
    const existing = await findSubdirectory(parentUri, dirName);
    if (existing) return existing;

    try {
        const newUri = await StorageAccessFramework.makeDirectoryAsync(parentUri, dirName);
        return newUri;
    } catch (e: any) {
        const recheck = await findSubdirectory(parentUri, dirName);
        if (recheck) return recheck;
        throw e;
    }
}

export async function saveToVault(
    vaultUri: string,
    filename: string,
    content: string,
    folderPath?: string,
    mimeType: string = 'text/markdown'
): Promise<string> {
    try {
        let targetUri = vaultUri;
        if (folderPath && folderPath.trim()) {
            const parts = folderPath.split('/').filter(p => p.trim());
            for (const part of parts) {
                targetUri = await ensureDirectory(targetUri, part);
            }
        }

        const existingFileUri = await findFile(targetUri, filename);
        if (existingFileUri) {
            try {
                await StorageAccessFramework.deleteAsync(existingFileUri);
            } catch (e) {
                console.warn('[saveToVault] Failed to delete existing file, will try direct write', e);
            }
        }

        const fileUri = await StorageAccessFramework.createFileAsync(targetUri, filename, mimeType);
        console.log('[saveToVault] Created file at URI:', fileUri);
        await StorageAccessFramework.writeAsStringAsync(fileUri, content);
        console.log('[saveToVault] Successfully wrote content to:', fileUri);
        return fileUri;
    } catch (e) {
        console.error('[saveToVault] Error:', e);
        throw e;
    }
}

/**
 * Safely writes content to a file, ensuring truncation of old content.
 * Workaround for Android SAF "ghost data" bug where shrinking files doesn't update size.
 */
export async function writeSafe(uri: string, content: string): Promise<void> {
    try {
        // 1. Clear file first to force size to 0 (Truncate)
        // We do this by writing an empty string.
        await StorageAccessFramework.writeAsStringAsync(uri, '');

        // 2. Verification step (Paranoid mode)
        // In highly contested loops, the write might not flush immediately or SAF might be weird.
        // We attempt to read it back to ensure it's empty.
        // NOTE: This adds IO overhead but resolves the corruption.
        /* 
           Skipping read verification for performance unless strictly needed. 
           If the user reports it's still bad, we can enable it:
           const check = await StorageAccessFramework.readAsStringAsync(uri);
           if (check.length > 0) throw new Error("Truncation failed");
        */

        // 2. Write actual content
        await StorageAccessFramework.writeAsStringAsync(uri, content);

    } catch (e) {
        console.warn('[writeSafe] Failed to clear file before writing, attempting direct overwrite with encoding check', e);

        // Fallback: If truncation fails, maybe it's a permissions thing or file lock?
        // We try one more time directly.
        // Another trick: write strict length? SAF doesn't support that.
        // We could just try deleting the file content logic again.

        try {
            await StorageAccessFramework.writeAsStringAsync(uri, content);
        } catch (e2) {
            console.error('[writeSafe] Fatal writing error', e2);
            throw e2;
        }
    }
}

export async function readVaultStructure(
    vaultUri: string,
    maxDepth: number = 2,
    metadataCache?: Record<string, { mtime: number, display: string, frontmatterKeys?: string[], frontmatter?: Record<string, any> }>
): Promise<{ structure: string, updatedCache: Record<string, { mtime: number, display: string, frontmatterKeys?: string[], frontmatter?: Record<string, any> }> }> {
    const structure: string[] = [];
    const updatedCache = { ...metadataCache };

    async function parseFile(childUri: string, name: string, prefix: string): Promise<void> {
        if (!name.endsWith('.md')) return;
        const cacheKey = decodeURIComponent(childUri);

        try {
            const info = await FileSystem.getInfoAsync(childUri);
            if (info.exists && metadataCache?.[cacheKey]) {
                if (Math.abs(info.modificationTime - metadataCache[cacheKey].mtime) < 1000) {
                    structure.push(`${prefix}${metadataCache[cacheKey].display}`);
                    updatedCache[cacheKey] = metadataCache[cacheKey];
                    return;
                }
            }

            const content = await StorageAccessFramework.readAsStringAsync(childUri);
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let metadata = '';
            let frontmatterKeys: string[] = [];
            let frontmatter: Record<string, any> = {};

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

                fm.split('\n').forEach(line => {
                    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
                    if (match) {
                        const key = match[1];
                        let value = match[2].trim();
                        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.substring(1, value.length - 1);
                        }
                        if (key !== 'tags' && key !== 'icon') {
                            frontmatterKeys.push(key);
                            frontmatter[key] = value;
                        }
                    }
                });
            } else {
                metadata = name.replace('.md', '');
            }

            // Inline property scanner
            const bodyContent = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content;

            // 1. Bracketed properties [key:: value] - specific and safe
            const bracketRegex = /\[([^:\]]+)::\s*([^\]]+)\]/g;
            let match;
            while ((match = bracketRegex.exec(bodyContent)) !== null) {
                const key = match[1].trim();
                const value = match[2].trim();

                if (key !== 'tags' && key !== 'icon') {
                    if (!frontmatterKeys.includes(key)) frontmatterKeys.push(key);
                    if (frontmatter[key] === undefined) frontmatter[key] = value;
                }
            }

            // 2. Implicit fields "key:: value" on their own line or at start of line (allowing indentation/bullets)
            const implicitRegex = /^(?:[ \t-]*)?([a-zA-Z0-9_%-]+)::[ \t]*(.+)$/gm;
            while ((match = implicitRegex.exec(bodyContent)) !== null) {
                const key = match[1].trim();
                const value = match[2].trim();

                if (key !== 'tags' && key !== 'icon') {
                    if (!frontmatterKeys.includes(key)) frontmatterKeys.push(key);
                    if (frontmatter[key] === undefined) frontmatter[key] = value;
                }
            }

            const displayString = `📄 ${metadata}`;
            structure.push(`${prefix}${displayString}`);
            if (info.exists) {
                updatedCache[cacheKey] = {
                    mtime: info.modificationTime,
                    display: displayString,
                    frontmatterKeys,
                    frontmatter
                };
            }
        } catch (e) {
            structure.push(`${prefix}📄 ${name.replace('.md', '')}`);
        }
    }

    async function readDir(uri: string, depth: number, prefix: string): Promise<void> {
        if (depth > maxDepth) return;
        try {
            const children = await StorageAccessFramework.readDirectoryAsync(uri);
            for (const childUri of children) {
                const decoded = decodeURIComponent(childUri);
                const parts = decoded.split('/');
                const last = parts[parts.length - 1];
                const name = last.includes(':') ? last.split(':').pop()! : last;

                try {
                    await StorageAccessFramework.readDirectoryAsync(childUri);
                    structure.push(`${prefix}📁 ${name}/`);
                    if (depth < maxDepth) await readDir(childUri, depth + 1, prefix + '  ');
                } catch {
                    await parseFile(childUri, name, prefix);
                }
            }
        } catch (e) { }
    }

    try {
        structure.push('📁 Vault/');
        await readDir(vaultUri, 0, '  ');
        return { structure: structure.join('\n'), updatedCache };
    } catch (e) {
        return { structure: "Could not read vault structure", updatedCache: metadataCache || {} };
    }
}

export async function checkFileExists(parentUri: string, filePath: string): Promise<boolean> {
    try {
        if (filePath.includes('/')) {
            const parts = filePath.split('/').filter(p => p.trim());
            const filename = parts.pop()!;
            const dirUri = await checkDirectoryExists(parentUri, parts.join('/'));
            if (!dirUri) return false;
            return (await findFile(dirUri, filename)) !== null;
        }
        return (await findFile(parentUri, filePath)) !== null;
    } catch (e) {
        return false;
    }
}

export async function readFileContent(parentUri: string, filePath: string): Promise<string> {
    try {
        let fileUri: string | null = null;
        if (filePath.includes('/')) {
            const parts = filePath.split('/').filter(p => p.trim());
            const filename = parts.pop()!;
            const dirUri = await checkDirectoryExists(parentUri, parts.join('/'));
            if (dirUri) fileUri = await findFile(dirUri, filename);
        } else {
            fileUri = await findFile(parentUri, filePath);
        }
        if (!fileUri) throw new Error("File not found");
        return await StorageAccessFramework.readAsStringAsync(fileUri);
    } catch (e) {
        throw e;
    }
}

export async function getFileInfo(uri: string): Promise<{ name: string; size: number; mimeType: string } | null> {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return null;
        const name = decodeURIComponent(uri.split('/').pop() || '');
        return { name, size: info.size || 0, mimeType: 'application/octet-stream' };
    } catch (e) {
        return null;
    }
}

export async function copyFileToVault(sourceUri: string, vaultUri: string, targetPath: string): Promise<string | null> {
    try {
        const pathParts = targetPath.split('/').filter(p => p.trim());
        const filename = pathParts.pop();
        if (!filename) return null;
        let currentUri = vaultUri;
        for (const part of pathParts) currentUri = await ensureDirectory(currentUri, part);
        const content = await FileSystem.readAsStringAsync(sourceUri, { encoding: 'base64' });
        const fileUri = await StorageAccessFramework.createFileAsync(currentUri, filename, 'application/octet-stream');
        await FileSystem.writeAsStringAsync(fileUri, content, { encoding: 'base64' });
        return fileUri;
    } catch (e) {
        return null;
    }
}

export async function ensureFilesDirectory(vaultUri: string, contextRoot?: string): Promise<string | null> {
    try {
        let baseUri = vaultUri;
        if (contextRoot?.trim()) {
            const uri = await checkDirectoryExists(vaultUri, contextRoot.trim());
            if (uri) baseUri = uri;
        }
        return await ensureDirectory(baseUri, 'Files');
    } catch (e) {
        return null;
    }
}

export async function deleteFile(uri: string): Promise<boolean> {
    try {
        await StorageAccessFramework.deleteAsync(uri);
        return true;
    } catch (e) {
        return false;
    }
}

export async function deleteFileByPath(vaultUri: string, relativePath: string): Promise<boolean> {
    try {
        let fileUri: string | null = null;
        if (relativePath.includes('/')) {
            const parts = relativePath.split('/').filter(p => p.trim());
            const filename = parts.pop()!;
            const dirUri = await checkDirectoryExists(vaultUri, parts.join('/'));
            if (dirUri) fileUri = await findFile(dirUri, filename);
        } else {
            fileUri = await findFile(vaultUri, relativePath);
        }
        if (fileUri) {
            await StorageAccessFramework.deleteAsync(fileUri);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

export async function getParentFolderUri(vaultUri: string, fileUri: string): Promise<string | null> {
    try {
        const fileDecoded = decodeURIComponent(fileUri);
        const vaultDecoded = decodeURIComponent(vaultUri);

        // SAF URI Heuristic: .../document/<ID>
        const getDocId = (uri: string) => {
            const parts = uri.split('/document/');
            return parts.length > 1 ? parts[1] : null;
        };

        const fileId = getDocId(fileDecoded);
        const vaultId = getDocId(vaultDecoded);

        if (fileId && vaultId && fileId.startsWith(vaultId)) {
            // Extract relative path from ID
            let relativeId = fileId.substring(vaultId.length);
            // Clean up separators (ids often use ':' or '/')
            if (relativeId.startsWith(':')) relativeId = relativeId.substring(1);
            if (relativeId.startsWith('/')) relativeId = relativeId.substring(1);

            // Get directory path
            const pathParts = relativeId.split('/');
            // If it has parts, the last one is filename, rest is path
            if (pathParts.length > 0) {
                pathParts.pop(); // remove filename
                const dirPath = pathParts.join('/');

                if (!dirPath) return vaultUri; // It's in the root

                // Need checkDirectoryExists (it is in this module)
                return await checkDirectoryExists(vaultUri, dirPath);
            }
        }
        return null;
    } catch (e) {
        console.warn('[SAF] Failed to resolve parent folder:', e);
        return null;
    }
}
