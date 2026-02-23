import fs from 'fs';
import path from 'path';
import { GraphCodec } from '../src/engine/GraphCodec';
import { Brain } from '../src/engine/Brain';
import { PayloadUtils } from '../src/utils/PayloadUtils';

async function testEvaluation() {
    console.log('--- Testing DA Node Evaluation ---');
    const cglPath = path.resolve(__dirname, '../public/da_nodes_test.cgl');
    const content = fs.readFileSync(cglPath, 'utf-8');

    // 1. Parse Graph
    const { graph, diagnostics } = GraphCodec.parse(content);
    if (diagnostics.length > 0) {
        console.error('Parse Errors:', diagnostics);
        return;
    }

    // 2. Initialize Brain (Main thread mode for debugging)
    const brain = Brain.getInstance();
    brain.silentReset();
    await brain.setWorkerMode(false); // disable worker to see errors in main thread

    // 3. Inject Graph
    for (const node of graph.nodes) {
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: node.id,
                type: node.type,
                position: node.position,
                initialValue: node.value,
                data: node.data
            }
        });
    }

    for (const edge of graph.edges) {
        brain.applyTransaction({
            type: 'CONNECT',
            payload: edge
        });
    }

    console.log('Graph state initialized. Starting evaluation...');

    // 4. Trigger Evaluation for a Result node or the DA nodes directly
    // Let's check stats (DA-01)
    const statsId = 'stats';
    try {
        const result = await brain.getValue(statsId);
        console.log(`[DA-01 Result]:`, JSON.stringify(result));
    } catch (e) {
        console.error(`[DA-01 Error]:`, e);
    }

    // Check op (DA-04 Intersection)
    const opId = 'op';
    try {
        const result = await brain.getValue(opId);
        console.log(`[DA-04 Result]:`, JSON.stringify(result));
    } catch (e) {
        console.error(`[DA-04 Error]:`, e);
    }
}

testEvaluation().catch(console.error);
