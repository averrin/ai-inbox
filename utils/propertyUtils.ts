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

/**
 * Extract unique property values for a specific key from VaultService metadata cache
 */
export function getPropertyValuesFromCache(metadataCache: Record<string, { frontmatter?: Record<string, any> }>, key: string): string[] {
    const trimmedKey = key.trim();
    if (!trimmedKey) return [];

    const allValues = new Set<string>();

    Object.values(metadataCache).forEach(file => {
        if (file.frontmatter && file.frontmatter[trimmedKey] !== undefined) {
            const val = file.frontmatter[trimmedKey];
            if (val !== null && val !== '') {
                allValues.add(String(val));
            }
        }
    });

    // Return sorted values
    return Array.from(allValues).sort();
}
