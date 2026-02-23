import fs from 'fs';
import path from 'path';
import { GraphCodec } from '../src/engine/GraphCodec';

const cglPath = path.resolve(__dirname, '../public/da_nodes_test.cgl');
const content = fs.readFileSync(cglPath, 'utf-8');

const { graph, diagnostics } = GraphCodec.parse(content);

console.log('Diagnostics:', diagnostics);
console.log('Nodes parsed:', graph.nodes.map(n => n.id + ' (' + n.type + ')').join(', '));
if (diagnostics.length > 0) {
    process.exit(1);
}
console.log('Edges parsed:', graph.edges.map(e => e.source + ':' + e.sourceHandle + ' -> ' + e.target + ':' + e.targetHandle).join(', '));
process.exit(0);
