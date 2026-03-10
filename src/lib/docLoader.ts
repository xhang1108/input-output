import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface DocMetadata {
    title: string;
    order: number;
    icon?: string;
}

export interface DocContent {
    id: string;
    metadata: DocMetadata;
    content: string;
}

export interface DocSection {
    id: string;
    title: string;
    items: DocContent[];
}

const DOCS_PATH = path.join(process.cwd(), 'src/assets/docs');

/**
 * Builds a list of sections and their corresponding documents for a given mode (operator/engineer).
 * Scanning is automatic based on subdirectories within the mode folder.
 */
export function getWikiData(mode: string): DocSection[] {
    const modePath = path.join(DOCS_PATH, mode);

    if (!fs.existsSync(modePath)) {
        return [];
    }

    const entries = fs.readdirSync(modePath, { withFileTypes: true });

    const sections: DocSection[] = entries
        .filter(entry => entry.isDirectory())
        .map(dir => {
            const sectionPath = path.join(modePath, dir.name);
            const files = fs.readdirSync(sectionPath);

            const items = files
                .filter(file => file.endsWith('.md'))
                .map(file => {
                    const filePath = path.join(sectionPath, file);
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    const { data, content } = matter(fileContent);

                    return {
                        id: file.replace('.md', ''),
                        metadata: data as DocMetadata,
                        content
                    };
                })
                .sort((a, b) => (a.metadata.order || 0) - (b.metadata.order || 0));

            // Clean title: "01_Physics" -> "Physics"
            const cleanTitle = dir.name.replace(/^\d+_/, '').replace(/-/g, ' ');

            return {
                id: dir.name.toLowerCase(),
                title: cleanTitle,
                items
            };
        });

    // Sort sections by folder prefix "01_", "02_", etc.
    return sections.sort((a, b) => {
        const aMatch = a.id.match(/^(\d+)_/);
        const bMatch = b.id.match(/^(\d+)_/);
        if (aMatch && bMatch) {
            return parseInt(aMatch[1]) - parseInt(bMatch[1]);
        }
        return a.id.localeCompare(b.id);
    });
}

/**
 * Provides a flat list of all available documentation IDs across all modes and sections.
 * Used by the UI to determine if "View Specs" should be shown.
 */
export function getAvailableDocIds(): string[] {
    const allIds: string[] = [];

    const scan = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        entries.forEach(entry => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                scan(fullPath);
            } else if (entry.name.endsWith('.md')) {
                allIds.push(entry.name.replace('.md', ''));
            }
        });
    };

    scan(DOCS_PATH);
    return allIds;
}
