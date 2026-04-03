/**
 * Node Category Priority
 * This is the SINGLE SOURCE OF TRUTH for node category sorting across the application.
 */
export const CATEGORY_PRIORITY = [
    'Input',
    'Output',
    'Math',
    'Calculus',
    'Data & Structures',
    'Transform',
    'Logic & Flow',
    'Utility'
];

/**
 * Sorts an array of category names or objects with a category field
 * based on the CATEGORY_PRIORITY list.
 */
export function sortCategories<T>(
    items: T[], 
    getCategory: (item: T) => string = (item: any) => item as string
): T[] {
    return [...items].sort((a, b) => {
        const catA = getCategory(a);
        const catB = getCategory(b);
        
        const indexA = CATEGORY_PRIORITY.indexOf(catA);
        const indexB = CATEGORY_PRIORITY.indexOf(catB);
        
        // If both are in priority list, sort by index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        
        // Items in priority list come first
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        // Otherwise sort alphabetically
        return catA.localeCompare(catB);
    });
}

