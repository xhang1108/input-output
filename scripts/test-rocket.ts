import fs from 'fs';
import path from 'path';
import { GraphCodec } from '../src/engine/GraphCodec';
import { Brain } from '../src/engine/Brain';

async function testRocket() {
    console.log('Testing Tsiolkovsky Rocket Equation...');
    const cglPath = path.resolve(__dirname, 'rocket.cgl');
    const content = fs.readFileSync(cglPath, 'utf-8');

    // Parse CGL
    const { graph, diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        console.error('CGL Parse Errors:', diagnostics);
        return;
    }

    // Load into Brain
    const brain = Brain.getInstance();
    await brain.injectNodes(graph, true);

    // Force calculation directly
    const value = await brain.getValue('out');

    console.log('Result payload:', JSON.stringify(value, null, 2));

    const symbol = brain.getSymbol('out');
    console.log('AST/Soul mapping:');
    if (symbol) {
        console.log(JSON.stringify(symbol, null, 2));
    } else {
        console.log('No symbol found');
    }
    process.exit(0);
}

testRocket();
