// @ts-nocheck
import { Parser } from './src/iogl/Parser';
import { NodeRegistry } from './src/engine/NodeRegistry';

NodeRegistry.initializeNodes();

const iogl = `[V2] IN-01 2 @0,300`;
const p = new Parser(iogl);
const { graph, diagnostics } = p.parse();

console.log('--- Results ---');
console.log('Nodes:', graph.nodes.length);
console.log('Diagnostics:', diagnostics);
if (graph.nodes.length > 0) {
    const node = graph.nodes[0];
    console.log('Node 0 Label:', node.data.label);
    console.log('Node 0 Type:', node.type);
    console.log('Node 0 Value:', JSON.stringify(node.data.value));
    console.log('Node 0 Pos:', node.position);
} else {
    // Check tokens
    console.log('No nodes created. Checking Lexer tokens...');
    // Accessing private tokens via hack
    const tokens = p['lexer']['tokens'];
    tokens.forEach((t, i) => {
        console.log(`Token ${i}: ${t.type} (${t.value})`);
    });
}
