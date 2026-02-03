
/**
 * Extract unique property keys from VaultService metadata cache
 */
export function getPropertyKeysFromCache(metadataCache: Record<string, { frontmatterKeys?: string[] }>): string[] {
    const allKeys = new Set<string>();

    Object.values(metadataCache).forEach(file => {
        if (file.frontmatterKeys) {
            file.frontmatterKeys.forEach(k => allKeys.add(k));
        }
    });

    // Return sorted keys
    return Array.from(allKeys).sort();
}
