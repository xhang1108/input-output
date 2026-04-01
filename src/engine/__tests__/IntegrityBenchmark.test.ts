import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Brain } from '../Brain';
import { GraphCodec } from '../GraphCodec';
import { NodeRegistry } from '../NodeRegistry';
import { InputOutputEngine } from '../InputOutputEngine';
import { PayloadUtils } from '../../utils/PayloadUtils';

/**
 * Node Integrity Benchmark Runner
 * 
 * This test suite runs a set of "Golden Graphs" (.iogl) that cover
 * every node and every mode. It ensures that the final calculated
 * results remain consistent across engine updates.
 */

// --- Golden Results (The Source of Truth) ---
// These values are captured from a known-good state.
const GOLDEN_RESULTS: Record<string, Record<string, any>> = {
    'benchmark_math.iogl': {
        'Res_Arith': 6,
        'Res_GCD': 6,
        'Res_NCR': 10
    },
    'benchmark_calculus.iogl': {
        'Res_D2': '-8 + 6*x',
        'Res_Int': -0.6666666666666666,
        'Res_Lim': -3,             // lim_{x->0} f(x)
        'Res_Solve': [2, -2]
    },
    'benchmark_data.iogl': {
        'Res_Det': -2,             // det([[1,2],[3,4]])
        'Res_Ext': 5,              // extract index 1 from [1, 5, 9]
        'Res_Sort': [1, 2, 3],     // sort [3, 1, 2]
        'Res_Union': [1, 2, 3]     // {1,2} U {2,3}
    },
    'benchmark_logic.iogl': {
        'Res_Gate': false,         // AND(true, false)
        'Res_Switch': 100,         // cond=false -> B=100
        'Res_TrueArr': 500         // cond=true -> data=500
    }
};

describe('Node Integrity Benchmarks', () => {
    const benchmarksDir = path.resolve(process.cwd(), 'public/examples/benchmarks');

    beforeAll(() => {
        NodeRegistry.initializeNodes();
    });

    if (!fs.existsSync(benchmarksDir)) {
        it.skip('Benchmarks directory not found (skipping)', () => {});
        return;
    }

    const files = fs.readdirSync(benchmarksDir).filter(f => f.endsWith('.iogl'));

    files.forEach(filename => {
        it(`should produce golden results for ${filename}`, async () => {
            const content = fs.readFileSync(path.join(benchmarksDir, filename), 'utf-8');
            const { graph, diagnostics } = GraphCodec.parse(content);
            
            if (diagnostics.length > 0) {
                console.error(`Parse Errors in ${filename}:`, diagnostics);
            }
            expect(diagnostics, `Parse errors in ${filename}: ${diagnostics.join(', ')}`).toHaveLength(0);

            // Initialize a fresh Brain session for each benchmark
            // Use a unique ID to avoid collision
            const brainId = `bench_${filename.replace(/\./g, '_')}`;
            const brain = Brain.getComputeSession(brainId);
            brain.silentReset();
            // Force local evaluation for benchmarks (WebWorkers not supported in Vitest/Node by default)
            await brain.setWorkerMode(false);

            // Load graph into brain
            graph.nodes.forEach(node => {
                brain.applyTransaction({
                    type: 'ADD_NODE',
                    payload: { 
                        id: node.id,
                        type: node.type,
                        data: node.data,
                        position: node.position,
                        initialValue: node.value
                    }
                }, false);
            });

            graph.edges.forEach(edge => {
                brain.applyTransaction({
                    type: 'CONNECT',
                    payload: edge
                }, false);
            });

            // Trigger evaluation of all Result nodes defined in the Golden Results
            const expected = GOLDEN_RESULTS[filename];
            if (!expected) {
                console.warn(`No golden results defined for ${filename}. Skipping assertions.`);
                return;
            }

            // Map aliases to IDs (since GraphCodec might have changed them)
            // But usually aliases are preserved as IDs if available.
            // Result nodes in my tests are named like 'Res_Arith'
            for (const [nodeId, expectedValue] of Object.entries(expected)) {
                // Find node by label/ID
                const node = Array.from(brain.getNodesMap().values()).find(n => n.id === nodeId || n.data?.label === nodeId);
                
                if (!node) {
                    throw new Error(`Cold not find node "${nodeId}" in benchmark ${filename}`);
                }

                // Force pull evaluation
                const payload = await brain.getValue(node.id);
                
                if (payload.type === 'error') {
                    throw new Error(`Node "${nodeId}" produced error: ${payload.meta?.error || payload.value}`);
                }

                // Compare values
                try {
                    const math = InputOutputEngine.getInstance().getMathInstance();
                    let actualValue = (payload.value && typeof payload.value === 'object' && 'value' in payload.value) 
                        ? (payload.value as any).value 
                        : payload.value;

                    // Hydrate mathjs objects if present
                    if (actualValue && typeof actualValue === 'object' && 'mathjs' in (actualValue as any)) {
                        const hydrated = PayloadUtils.hydrate(actualValue as any, math) as any;
                        if (hydrated && typeof hydrated === 'object' && 'toNumber' in hydrated) {
                            actualValue = hydrated.toNumber();
                        } else {
                            actualValue = hydrated;
                        }
                    }

                    if (Array.isArray(expectedValue)) {
                        // For solutions/sets, order might not matter or be deterministic
                        // We sort both if they are simple values
                        const actualArr = Array.isArray(actualValue) ? [...actualValue] : [actualValue];
                        const expectedArr = [...expectedValue];
                        
                        const sortFn = (a: any, b: any) => String(a).localeCompare(String(b));
                        actualArr.sort(sortFn);
                        expectedArr.sort(sortFn);
                        
                        expect(actualArr).toEqual(expectedArr);
                    } else if (typeof expectedValue === 'number') {
                        // Number comparison (flexible for strings/numbers)
                        const actualNum = Number(actualValue);
                        expect(actualNum).toBeCloseTo(expectedValue, 10);
                    } else if (typeof expectedValue === 'string') {
                        // Normalize whitespace for strings
                        const normActual = String(actualValue).replace(/\s+/g, '');
                        const normExpected = expectedValue.replace(/\s+/g, '');
                        expect(normActual).toBe(normExpected);
                    } else {
                        expect(actualValue).toBe(expectedValue);
                    }
                } catch (e) {
                    console.error(`Benchmark Failure [${filename}] Node [${nodeId}]:`);
                    console.error(`  Expected: (${typeof expectedValue}) ${JSON.stringify(expectedValue)}`);
                    console.error(`  Actual:   (${typeof payload.value}) ${JSON.stringify(payload.value)}`);
                    throw e;
                }
            }

            // Cleanup
            brain.dispose();
        });
    });
});
