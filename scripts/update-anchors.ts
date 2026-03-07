import fs from 'fs';
import path from 'path';

const filePath = path.resolve(__dirname, '../src/definitions/nodeDefinitions.ts');
let content = fs.readFileSync(filePath, 'utf8');

// For IN-07 and UT-01 (Resizable nodes -> uiOrigin [0,0])
content = content.replace(/(id:\s*'IN-07',)/g, "$1\n        layoutMetadata: { uiOrigin: [0, 0], physicalAnchor: [0.5, 0.5] },");
content = content.replace(/(id:\s*'UT-01',)/g, "$1\n        layoutMetadata: { uiOrigin: [0, 0], physicalAnchor: [0.5, 0.5] },");

// For all other defined nodes
content = content.replace(/(id:\s*'([A-Z]{2}-\d{2})',)/g, (match, p1, p2) => {
    if (p2 === 'IN-07' || p2 === 'UT-01') return match; // Already handled
    return `${p1}\n        layoutMetadata: { uiOrigin: [0.5, 0.5], physicalAnchor: [0.5, 0.5] },`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated nodeDefinitions.ts');
