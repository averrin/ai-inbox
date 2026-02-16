export interface SuggestionResult {
    suggestions: string[];
    mode: 'append' | 'replace';
}

export async function getSuggestions(
    vaultUri: string,
    basePath: string | undefined,
    currentInput: string,
    listSubdirectoriesFn: (uri: string, path: string) => Promise<string[]>
): Promise<SuggestionResult> {
    if (!vaultUri) return { suggestions: [], mode: 'append' };

    const resolvedPath = basePath
        ? (currentInput ? `${basePath}/${currentInput}` : basePath)
        : currentInput;

    // 1. Try treating resolvedPath as a directory (append mode)
    // This handles exact matches like "Inbox" or "Inbox/"
    let dirs = await listSubdirectoriesFn(vaultUri, resolvedPath);
    if (dirs.length > 0) {
        return { suggestions: dirs, mode: 'append' };
    }

    // 2. Try partial matching (replace mode)
    // If input doesn't end with '/', treat last part as partial name
    if (!currentInput.endsWith('/')) {
         // We need to resolve the parent path relative to basePath
         // If currentInput = "In", resolvedPath = "base/In".
         // Parent of resolvedPath = "base". Partial = "In".

         const parts = resolvedPath.split('/');
         const partial = parts.pop() || '';
         const parentPath = parts.join('/');

         // If partial is empty, we already handled it above (dirs would match root/basePath children).
         if (partial) {
             dirs = await listSubdirectoriesFn(vaultUri, parentPath);
             const matches = dirs.filter(d => d.toLowerCase().startsWith(partial.toLowerCase()));

             if (matches.length > 0) {
                 return { suggestions: matches, mode: 'replace' };
             }
         }
    }

    return { suggestions: [], mode: 'append' };
}

export function applySuggestion(
    currentInput: string,
    suggestion: string,
    mode: 'append' | 'replace'
): string {
    if (mode === 'replace') {
         // Replace last segment of input with suggestion
         const parts = currentInput.split('/');
         parts.pop(); // Remove partial
         parts.push(suggestion);
         return parts.join('/') + '/';
    } else {
         // Append
         return (currentInput ? `${currentInput.replace(/\/$/, '')}/${suggestion}` : suggestion) + '/';
    }
}

export function resolveBrowsePath(
    vaultUri: string,
    directoryUri: string,
    basePath: string | undefined
): string | null {
    try {
        const vaultDecoded = decodeURIComponent(vaultUri);
        const selectedDecoded = decodeURIComponent(directoryUri);

        const vaultMatch = vaultDecoded.match(/(?:tree|document)\/(.+?)$/);
        const selectedMatch = selectedDecoded.match(/(?:tree|document)\/(.+?)$/);

        if (vaultMatch && selectedMatch) {
            const vaultPath = vaultMatch[1];
            const selectedPath = selectedMatch[1];

            if (selectedPath.startsWith(vaultPath)) {
                let relativePath = selectedPath.substring(vaultPath.length);
                relativePath = relativePath.replace(/^\//, '');

                if (basePath && relativePath.startsWith(basePath)) {
                     if (relativePath.length === basePath.length) {
                         relativePath = '';
                     } else if (relativePath[basePath.length] === '/') {
                         relativePath = relativePath.substring(basePath.length + 1);
                     }
                }

                return relativePath;
            }
        }
    } catch (e) {
        console.error('[resolveBrowsePath] Error:', e);
    }
    return null;
}
