
import fs from 'fs';
import path from 'path';
import { GraphCodec } from '../src/engine/GraphCodec';

const command = process.argv[2];
const filePath = process.argv[3];

if (!command || !filePath) {
    console.error('Usage: npx tsx iogl-tool.ts <command> <file>');
    console.error('Commands: validate, compile');
    process.exit(1);
}

const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

const content = fs.readFileSync(absolutePath, 'utf-8');

if (command === 'validate') {
    console.log(`Validating ${absolutePath}...`);
    const { diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        console.error('Validation Errors:');
        diagnostics.forEach(d => console.error(`- ${d}`));
        process.exit(1);
    } else {
        console.log('✅ IOGL is valid.');
    }
} else if (command === 'compile') {
    const { graph, diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        console.error('Validation Errors:');
        diagnostics.forEach(d => console.error(`- ${d}`));
        process.exit(1);
    }
    console.log(JSON.stringify(graph, null, 2));
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
