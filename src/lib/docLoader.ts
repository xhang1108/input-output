import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface DocMetadata {
    title: string;
    order: number;
    icon?: string;
}

export interface TOCItem {
    id: string;
    title: string;
    level: number;
}

export interface DocContent {
    id: string;
    metadata: DocMetadata;
    content: string;
    toc: TOCItem[];
}

export interface DocSection {
    id: string;
    slug: string;
    title: string;
    items: DocContent[];
}

const DOCS_PATH = path.join(process.cwd(), 'src/assets/docs');

/**
 * Utility to extract headings from markdown content
 */
function extractHeadings(content: string): TOCItem[] {
    const headingRegex = /^(#{2,3})\s+(.+)$/gm;
    const toc: TOCItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
        const level = match[1].length;
        const rawTitle = match[2].trim();
        // Remove anchor notation like (IO-01) if present
        const title = rawTitle.replace(/\s*\([A-Z0-9-]+\)$/, '').trim();

        // Generate ID consistent with MarkdownRenderer's logic
        const anchorMatch = rawTitle.match(/\(([A-Z0-9-]{3,10})\)/);
        const id = anchorMatch ? anchorMatch[1] : title.toLowerCase()
            .replace(/[^\w-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        toc.push({ id, title, level });
    }
    return toc;
}

/**
 * Extract the main title (# H1) from content, or fallback to metadata
 */
function extractMainTitle(content: string, fallback: string): string {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
        return h1Match[1].trim().replace(/\s*\([A-Z0-9-]+\)$/, '');
    }
    return fallback;
}

/**
 * Builds a list of sections and their corresponding documents for a given mode (operator/engineer).
 * Scanning is automatic based on subdirectories within the mode folder.
 */
export function getWikiData(mode: string): DocSection[] {
    const modePath = path.join(DOCS_PATH, mode);
    const sharedPath = path.join(DOCS_PATH, 'shared');

    const getSectionsFromPath = (basePath: string) => {
        if (!fs.existsSync(basePath)) return [];
        const entries = fs.readdirSync(basePath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .map(dir => {
                const sectionPath = path.join(basePath, dir.name);
                const files = fs.readdirSync(sectionPath);

                const items = files
                    .filter(file => file.endsWith('.md'))
                    .map(file => {
                        const filePath = path.join(sectionPath, file);
                        const fileContent = fs.readFileSync(filePath, 'utf8');
                        const { data, content } = matter(fileContent);

                        const toc = extractHeadings(content);
                        const title = extractMainTitle(content, (data as DocMetadata).title || file.replace('.md', ''));

                        const docItem = {
                            id: file.replace('.md', ''),
                            metadata: { ...data, title } as DocMetadata,
                            content,
                            toc
                        };

                        // Sanitize: Force serialization to plain object to avoid Set/non-plain objects from gray-matter
                        return JSON.parse(JSON.stringify(docItem));
                    })
                    .sort((a, b) => (a.metadata.order || 0) - (b.metadata.order || 0));

                const cleanTitle = dir.name.replace(/^\d+_/, '').replace(/-/g, ' ');
                const slug = dir.name.replace(/^\d+_/, '').toLowerCase().replace(/_/g, '-');

                return {
                    id: dir.name.toLowerCase(),
                    slug,
                    title: cleanTitle,
                    items
                };
            });
    };

    const modeSections = getSectionsFromPath(modePath);
    const sharedSections = getSectionsFromPath(sharedPath);

    // Merge sections, giving priority to mode sections if IDs collide (though they shouldn't by convention)
    const combinedMap = new Map<string, DocSection>();
    sharedSections.forEach(s => combinedMap.set(s.id, s));
    modeSections.forEach(s => combinedMap.set(s.id, s));

    const combinedSections = Array.from(combinedMap.values());
    
    // Filter out system section for user mode
    const filteredSections = mode === 'user' 
        ? combinedSections.filter(s => s.id !== '00_system')
        : combinedSections;

    // Sort sections by folder prefix "00_", "01_", etc.
    return filteredSections.sort((a, b) => {
        const aMatch = a.id.match(/^(\d+)_/);
        const bMatch = b.id.match(/^(\d+)_/);

        const aNum = aMatch ? parseInt(aMatch[1]) : 999;
        const bNum = bMatch ? parseInt(bMatch[1]) : 999;

        if (aNum !== bNum) return aNum - bNum;
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

