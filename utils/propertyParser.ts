
/**
 * Robustly parses inline properties in the format [key:: value] from text.
 * Handles nested brackets like [key:: [[link]]].
 */
export function parseInlineProperties(text: string): { properties: Record<string, string>, cleanedText: string } {
    const properties: Record<string, string> = {};
    let cleanedText = "";

    let i = 0;
    while (i < text.length) {
        // Check for start of a potential property: [
        if (text[i] === '[') {
            let j = i + 1;
            let bracketCount = 1;
            let separatorFound = false;
            let potentialKey = "";
            let potentialValue = "";
            let splitIndex = -1;

            // Scan forward to find balancing closing bracket
            while (j < text.length && bracketCount > 0) {
                if (text[j] === '[') {
                    bracketCount++;
                } else if (text[j] === ']') {
                    bracketCount--;
                }

                if (bracketCount > 0) {
                     // Look for separator '::' ONLY at the top level (bracketCount === 1)
                     if (bracketCount === 1 && !separatorFound && text[j] === ':' && text[j+1] === ':') {
                         separatorFound = true;
                         splitIndex = j;
                     }
                }
                j++;
            }

            if (bracketCount === 0 && separatorFound) {
                // We found a well-formed [key:: value] block
                // The block is from text[i] to text[j-1]
                // The separator starts at splitIndex

                const key = text.substring(i + 1, splitIndex).trim();
                const value = text.substring(splitIndex + 2, j - 1).trim();

                if (key) {
                    properties[key] = value;

                    // Skip adding this block to cleanedText
                    i = j;
                    continue;
                }
            }
        }

        cleanedText += text[i];
        i++;
    }

    // Clean up extra spaces that might have been left behind (e.g. "Task  " -> "Task")
    // But be careful not to merge words that shouldn't be merged.
    // Usually properties are at the end, or separated by spaces.
    // Ideally we'd normalize spaces.
    return { properties, cleanedText: cleanedText.replace(/\s+/g, ' ').trim() };
}

/**
 * Serializes properties map back to inline format string.
 * Filters out undefined/null/"undefined" values.
 */
export function serializeInlineProperties(properties: Record<string, string>): string {
    let result = "";
    const keys = Object.keys(properties).sort();

    for (const key of keys) {
        const value = properties[key];

        // Robust check for invalid values
        if (
            value === undefined ||
            value === null ||
            value === "undefined" ||
            (typeof value === 'string' && value.trim() === "")
        ) {
            continue;
        }

        result += ` [${key}:: ${value}]`;
    }

    return result;
}
