import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as FileSystem from 'expo-file-system/legacy';

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
                return null;
            }
            currentUri = found;
        }


        return currentUri;
    }

    // Single folder name
    return findSubdirectory(parentUri, dirName);
}

export async function readVaultStructure(
    vaultUri: string,
    maxDepth: number = 2,
    metadataCache?: Record<string, { mtime: number, display: string }>
): Promise<{ structure: string, updatedCache: Record<string, { mtime: number, display: string }> }> {
    try {
        const structure: string[] = [];
        const updatedCache = { ...metadataCache };

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
                            const cacheKey = decoded;
                            let useCached = false;

                            try {
                                const info = await FileSystem.getInfoAsync(childUri);
                                if (info.exists && metadataCache && metadataCache[cacheKey]) {
                                    if (Math.abs(info.modificationTime - metadataCache[cacheKey].mtime) < 1000) {
                                        // Cache hit!
                                        structure.push(`${prefix}${metadataCache[cacheKey].display}`);
                                        updatedCache[cacheKey] = metadataCache[cacheKey]; // Keep in new cache
                                        useCached = true;
                                    }
                                }

                                if (!useCached) {
                                    // Cache miss or stale - Read content
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

                                    const displayString = `📄 ${metadata}`;
                                    structure.push(`${prefix}${displayString}`);

                                    // Update cache
                                    if (info.exists) {
                                        updatedCache[cacheKey] = {
                                            mtime: info.modificationTime,
                                            display: displayString
                                        };
                                    }
                                }

                            } catch (e) {
                                // If can't read file or info, just show name
                                // console.warn(`Error reading file ${name}`, e);
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

        return { structure: structure.join('\n'), updatedCache };
    } catch (e) {
        console.error("Error reading vault structure:", e);
        return { structure: "Could not read vault structure", updatedCache: metadataCache || {} };
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
                return uri;
            }

            // Manual extraction
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

export async function ensureDirectory(parentUri: string, dirName: string): Promise<string> {
    const existing = await findSubdirectory(parentUri, dirName);
    if (existing) {
        return existing;
    }

    try {
        const newUri = await StorageAccessFramework.makeDirectoryAsync(parentUri, dirName);
        return newUri;
    } catch (e: any) {
        // Race condition: check if it exists now
        const recheck = await findSubdirectory(parentUri, dirName);
        if (recheck) {
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

        const existingFileUri = await findFile(targetUri, filename);

        if (existingFileUri) {
            await StorageAccessFramework.writeAsStringAsync(existingFileUri, content);
            return existingFileUri;
        } else {
            const fileUri = await StorageAccessFramework.createFileAsync(targetUri, filename, 'text/markdown');
            await StorageAccessFramework.writeAsStringAsync(fileUri, content);
            return fileUri;
        }
    } catch (e) {
        console.error('[saveToVault] Error:', e);
        throw e;
    }
}

async function findFile(parentUri: string, filename: string): Promise<string | null> {
    try {
        const children = await StorageAccessFramework.readDirectoryAsync(parentUri);
        const targetName = filename.toLowerCase();

        for (const uri of children) {
            const decoded = decodeURIComponent(uri);

            // Extract filename from URI
            const parts = decoded.split('/');
            const last = parts[parts.length - 1];
            let name = last.includes(':') ? last.split(':').pop() : last;

            if (name?.toLowerCase() === targetName) {
                return uri;
            }
        }

        // console.warn(`[findFile] Not found: ${filename}`);
        return null;
    } catch (e) {
        console.error(`[findFile] Error searching for ${filename}:`, e);
        return null;
    }
}

export async function checkFileExists(parentUri: string, filePath: string): Promise<boolean> {
    try {
        // Handle nested paths like "folder/file.md"
        if (filePath.includes('/')) {
            const parts = filePath.split('/').filter(p => p.trim());
            const filename = parts.pop()!;
            const dirPath = parts.join('/');

            // Navigate to the directory first
            const dirUri = await checkDirectoryExists(parentUri, dirPath);
            if (!dirUri) {
                return false;
            }

            // Then check for the file
            const fileUri = await findFile(dirUri, filename);
            return fileUri !== null;
        }

        // Single file in root
        const fileUri = await findFile(parentUri, filePath);
        return fileUri !== null;
    } catch (e) {
        console.error('[checkFileExists] Error:', e);
        return false;
    }
}

export async function readFileContent(parentUri: string, filePath: string): Promise<string> {
    try {
        // Handle nested paths like "folder/file.md"
        if (filePath.includes('/')) {
            const parts = filePath.split('/').filter(p => p.trim());
            const filename = parts.pop()!;
            const dirPath = parts.join('/');

            // Navigate to the directory first
            const dirUri = await checkDirectoryExists(parentUri, dirPath);
            if (!dirUri) {
                throw new Error(`Directory not found: ${dirPath}`);
            }

            // Then find and read the file
            const fileUri = await findFile(dirUri, filename);
            if (!fileUri) {
                throw new Error(`File not found: ${filename} in ${dirPath}`);
            }

            return await StorageAccessFramework.readAsStringAsync(fileUri);
        }

        // Single file in root
        const fileUri = await findFile(parentUri, filePath);
        if (!fileUri) {
            throw new Error(`File not found: ${filePath}`);
        }

        return await StorageAccessFramework.readAsStringAsync(fileUri);
    } catch (e) {
        console.error('[readFileContent] Error:', e);
        throw e;
    }
}

/**
 * Get file information from a URI
 */
export async function getFileInfo(uri: string): Promise<{ name: string; size: number; mimeType: string } | null> {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return null;

        // Extract filename from URI
        const uriParts = uri.split('/');
        const name = decodeURIComponent(uriParts[uriParts.length - 1]);

        return {
            name,
            size: info.size || 0,
            mimeType: 'application/octet-stream' // FileSystem doesn't provide mimeType
        };
    } catch (e) {
        console.error('[getFileInfo] Error:', e);
        return null;
    }
}

/**
 * Copy a file to the vault
 */
export async function copyFileToVault(
    sourceUri: string,
    vaultUri: string,
    targetPath: string
): Promise<string | null> {
    try {
        // Handle nested paths
        const pathParts = targetPath.split('/').filter(p => p.trim());
        const filename = pathParts.pop();

        if (!filename) {
            console.error('[copyFileToVault] Invalid target path');
            return null;
        }

        // Ensure parent directories exist
        let currentUri = vaultUri;
        for (const part of pathParts) {
            currentUri = await ensureDirectory(currentUri, part);
        }

        // Read source file as base64
        const fileContent = await FileSystem.readAsStringAsync(sourceUri, {
            encoding: 'base64'
        });

        // Create file in vault
        const fileUri = await StorageAccessFramework.createFileAsync(
            currentUri,
            filename,
            'application/octet-stream'
        );

        // Write content
        await FileSystem.writeAsStringAsync(fileUri, fileContent, {
            encoding: 'base64'
        });

        return fileUri;
    } catch (e) {
        console.error('[copyFileToVault] Error:', e);
        return null;
    }
}

/**
 * Ensure Files directory exists in context root
 */
export async function ensureFilesDirectory(
    vaultUri: string,
    contextRoot?: string
): Promise<string | null> {
    try {
        let baseUri = vaultUri;

        // Navigate to context root if specified
        if (contextRoot && contextRoot.trim()) {
            const contextUri = await checkDirectoryExists(vaultUri, contextRoot.trim());
            if (contextUri) {
                baseUri = contextUri;
            }
        }

        // Ensure Files directory exists
        return await ensureDirectory(baseUri, 'Files');
    } catch (e) {
        console.error('[ensureFilesDirectory] Error:', e);
        return null;
    }
}
/**
 * Delete a file from the vault
 */
export async function deleteFile(uri: string): Promise<boolean> {
    try {
        await StorageAccessFramework.deleteAsync(uri);
        return true;
    } catch (e) {
        console.error('[deleteFile] Error:', e);
        return false;
    }
}

/**
 * Delete a file from the vault by relative path
 */
export async function deleteFileByPath(vaultUri: string, relativePath: string): Promise<boolean> {
    try {
        // Handle nested paths
        if (relativePath.includes('/')) {
            const parts = relativePath.split('/').filter(p => p.trim());
            const filename = parts.pop()!;
            const dirPath = parts.join('/');

            const dirUri = await checkDirectoryExists(vaultUri, dirPath);
            if (!dirUri) return false;

            const fileUri = await findFile(dirUri, filename);
            if (!fileUri) return false;

            await StorageAccessFramework.deleteAsync(fileUri);
            return true;
        }

        // Single file
        const fileUri = await findFile(vaultUri, relativePath);
        if (!fileUri) return false;

        await StorageAccessFramework.deleteAsync(fileUri);
        return true;
    } catch (e) {
        console.error('[deleteFileByPath] Error:', e);
        return false;
    }
}
