import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_PATH = path.resolve(__dirname, '../src/assets/docs');
const OUTPUT_PATH = path.resolve(__dirname, '../src/config/docRegistry.ts');

interface DocEntry {
    id: string;
    modes: string[];
}

const registryMap = new Map<string, DocEntry>();
const nodeDocMap: Record<string, string> = {};

function scanDocs(dir: string, registry: Map<string, DocEntry>, currentMode: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const mode = (dir === DOCS_PATH) ? entry.name : currentMode;
            scanDocs(fullPath, registry, mode);
        } else if (entry.name.endsWith('.md')) {
            const id = entry.name.replace('.md', '');
            if (registry.has(id)) {
                const existing = registry.get(id)!;
                if (!existing.modes.includes(currentMode)) existing.modes.push(currentMode);
            } else {
                registry.set(id, { id, modes: [currentMode] });
            }

            // Read content to extract (XX-00) headers
            const content = fs.readFileSync(fullPath, 'utf8');
            const matches = content.matchAll(/\(([A-Z0-9]{2}-\d{2})\)/g);
            for (const match of matches) {
                nodeDocMap[match[1]] = id;
            }
        }
    });
}

scanDocs(DOCS_PATH, registryMap, '');

const registryArray = Array.from(registryMap.values()).sort((a, b) => a.id.localeCompare(b.id));

const content = `// This file is auto-generated. Do not edit manually.
export interface DocEntry {
  id: string;
  modes: string[];
}

export const DOC_REGISTRY: DocEntry[] = ${JSON.stringify(registryArray, null, 2)};
export const NODE_DOC_MAP: Record<string, string> = ${JSON.stringify(nodeDocMap, null, 2)};

export function getDocInfo(nodeType: string, opToken?: string): { sectionId: string, anchor: string } | undefined {
  if (NODE_DOC_MAP[nodeType]) {
      return { sectionId: NODE_DOC_MAP[nodeType], anchor: nodeType };
  }
  // Fallback map exact opTokens if no nodeType matches
  if (opToken) {
      const slug = opToken.replace(/:/g, '-');
      if (DOC_REGISTRY.find(d => d.id === slug)) {
          return { sectionId: slug, anchor: slug };
      }
  }
  return undefined;
}

export function hasDocForToken(nodeType: string, opToken?: string): boolean {
  return !!getDocInfo(nodeType, opToken);
}
`;

fs.writeFileSync(OUTPUT_PATH, content);
console.log(`Doc registry updated with ${registryArray.length} items.`);
