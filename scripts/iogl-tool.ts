
import fs from 'fs';
import path from 'path';
import { GraphCodec } from '../src/engine/GraphCodec';

const command = process.argv[2];
const filePath = process.argv[3];

if (!command || !filePath) {
    console.error('Usage: npx tsx iogl-tool.ts <command> <file|dir>');
    console.error('Commands: validate, compile, test-dir, audit');
    process.exit(1);
}

const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
}

if (command === 'validate') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    console.log(`Validating ${absolutePath}...`);
    const { diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        console.error('Validation Errors:');
        diagnostics.forEach(d => console.error(`  - ${JSON.stringify(d, null, 2)}`));
        process.exit(1);
    } else {
        console.log('IOGL is valid.');
    }
} else if (command === 'compile') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const { graph, diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        console.error('Validation Errors:');
        diagnostics.forEach(d => console.error(`  - ${d}`));
        process.exit(1);
    }
    console.log(JSON.stringify(graph, null, 2));
} else if (command === 'test-dir') {
    if (!fs.statSync(absolutePath).isDirectory()) {
        console.error(`${absolutePath} is not a directory.`);
        process.exit(1);
    }
    const files = fs.readdirSync(absolutePath).filter(f => f.endsWith('.iogl'));
    let pass = 0, fail = 0;
    files.forEach(f => {
        const p = path.join(absolutePath, f);
        console.log(`- Checking: ${p}`);
        if (fs.statSync(p).isDirectory()) {
            console.log(`  (Skipping directory ${f})`);
            return;
        }
        const c = fs.readFileSync(p, 'utf-8');
        const { diagnostics } = GraphCodec.parse(c);
        if (diagnostics.length > 0) {
            console.error(`${f}: ${diagnostics.length} errors`);
            diagnostics.forEach(d => console.error(`  - ${d}`));
            fail++;
        } else {
            console.log(`${f}: OK`);
            pass++;
        }
    });
    console.log(`\nResults: ${pass} passed, ${fail} failed.`);
    process.exit(fail > 0 ? 1 : 0);
} else if (command === 'audit') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    console.log(`Auditing ${absolutePath} for IOGL 1.0 Integrity...`);
    // Audit logic: Check for nodes not in MANIFEST or missing properties
    const { graph, diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        diagnostics.forEach(d => console.error(`  - ${d}`));
    }

    // Check for Ghost Links (handles missing from definitions)
    const { IOGL_MANIFEST } = require('../src/iogl/manifest');
    const { NODE_DEFINITIONS } = require('../src/definitions/nodeDefinitions');

    graph.nodes.forEach(node => {
        if (!IOGL_MANIFEST[node.type]) {
            console.warn(`️  Warning: Node ${node.type} ([${node.data?.label}]) missing from IOGL_MANIFEST.`);
        }
    });

    graph.edges.forEach(edge => {
        const sourceNode = graph.nodes.find(n => n.id === edge.source);
        const targetNode = graph.nodes.find(n => n.id === edge.target);
        if (sourceNode && targetNode) {
            // Check if handles exist in definitions
            const sDef = NODE_DEFINITIONS.find((d: any) => d.id === sourceNode.type);
            const tDef = NODE_DEFINITIONS.find((d: any) => d.id === targetNode.type);
            if (sDef && !sDef.handles.find((h: any) => h.id === edge.sourceHandle)) {
                console.warn(`Ghost Link: Source handle '${edge.sourceHandle}' not found in ${sDef.id} definition.`);
            }
            if (tDef && !tDef.handles.find((h: any) => h.id === edge.targetHandle)) {
                console.warn(`Ghost Link: Target handle '${edge.targetHandle}' not found in ${tDef.id} definition.`);
            }
        }
    });
    console.log('Audit complete.');
} else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
