
import { NodeRegistry } from '../src/engine/NodeRegistry';
import { PayloadUtils } from '../src/utils/PayloadUtils';
import { MathEngine } from '../src/engine/MathEngine';

// Mock dependencies if needed, or rely on real ones since we are using ts-node to run likely
// But MathEngine is a singleton, let's ensure it's initialized
MathEngine.getInstance();

async function test() {
    console.log('--- Testing MA-02 NumberTheoryNode ---');

    const runTest = async (op: string, a: any, b: any) => {
        console.log(`Testing Op: ${op}, A: ${a}, B: ${b}`);

        const inputs = {
            in_a: PayloadUtils.createScalar(a),
            in_b: PayloadUtils.createScalar(b)
        };

        const node = {
            id: 'test-node',
            type: 'MA-02',
            data: { op },
            value: null,
            position: { x: 0, y: 0 }
        };

        try {
            // @ts-ignore - Accessing private/protected execution for test
            const evaluator = (NodeRegistry as any).evaluators.get('MA-02');
            if (!evaluator) throw new Error('Evaluator not found for MA-02');

            const result = await evaluator(node, inputs);
            console.log('Result Payload:', JSON.stringify(result, null, 2));
        } catch (e) {
            console.error('Error:', e);
        }
        console.log('-----------------------------------');
    };

    await runTest('GCD', 12, 18); // Should be 6
    await runTest('LCM', 4, 6);   // Should be 12
    await runTest('IS_PRIME', 7, 0); // Should be true
    await runTest('IS_PRIME', 10, 0); // Should be false
}

test();
