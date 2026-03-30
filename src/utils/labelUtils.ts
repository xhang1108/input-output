/**
 * Utilities for handling node labels and uniqueness.
 */

/**
 * Generates a unique label by appending an incremental suffix if a collision is detected.
 * Uses smart regex-based suffixing to prevent nested suffixes (e.g., [Math - 01 - 01]).
 * 
 * @param suggested The initial label to check for uniqueness.
 * @param existing All currently existing labels in the context.
 * @returns A unique label with an optional '- 01' style suffix.
 */
export function getUniqueLabel(suggested: string, existing: string[]): string {
    if (!existing.includes(suggested)) {
        return suggested;
    }

    // Regex to find a base and an existing suffix (e.g., "Math - 01" -> ["Math", "01"])
    const suffixRegex = /(.*) - (\d+)$/;
    const match = suggested.match(suffixRegex);

    let base = suggested;
    let startNum = 1;

    if (match) {
        base = match[1];
        startNum = parseInt(match[2], 10) + 1;
    }

    let finalLabel = formatLabelWithSuffix(base, startNum);
    let attempts = startNum;

    while (existing.includes(finalLabel)) {
        attempts++;
        finalLabel = formatLabelWithSuffix(base, attempts);
        
        // Safety break
        if (attempts > 999) break;
    }

    return finalLabel;
}

function formatLabelWithSuffix(base: string, num: number): string {
    return `${base} - ${num.toString().padStart(2, '0')}`;
}
