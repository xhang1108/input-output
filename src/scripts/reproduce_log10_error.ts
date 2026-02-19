
import { NodeRegistry } from '../engine/NodeRegistry';
import { PayloadUtils } from '../utils/PayloadUtils';
import { MathEngine } from '../engine/MathEngine';

async function reproduceLog10Error() {
    console.log('🧪 Reproducing LOG10 Error (MA-16)...');

    // Initialize MathEngine
    MathEngine.getInstance();

    // Mock Input: 1000
    const input1000 = PayloadUtils.createScalar(1000);

    // Test Log10
    const nodeLog10 = { id: 'test_log10', type: 'MA-16', data: { op: 'LOG10' }, position: { x: 0, y: 0 }, isDirty: true } as any;

    try {
        const resultLog10 = await NodeRegistry.evaluate(nodeLog10, { in: input1000 });
        const valLog10 = PayloadUtils.unwrap(resultLog10);

        if (resultLog10.type === 'error') {
            console.log(`[LOG10] ❌ Returned Error Payload: ${valLog10}`);
        } else {
            console.log(`[LOG10] log10(1000) = ${valLog10} (Expected: 3)`);
        }
    } catch (e) {
        console.error(`[LOG10] 💥 Threw Exception:`, e);
    }
}

reproduceLog10Error().catch(console.error);
