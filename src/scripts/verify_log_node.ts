
import { NodeRegistry } from '../engine/NodeRegistry';
import { PayloadUtils } from '../utils/PayloadUtils';
import { MathEngine } from '../engine/MathEngine';

async function verifyLogNode() {
    console.log('🧪 Verifying LogNode (MA-16)...');

    // Initialize MathEngine
    MathEngine.getInstance();

    // Mock Inputs
    const inputE = PayloadUtils.createScalar(Math.E);
    const input100 = PayloadUtils.createScalar(100);
    const input8 = PayloadUtils.createScalar(8);
    const base2 = PayloadUtils.createScalar(2);

    // 1. Test Ln (Base e)
    const nodeLn = { id: 'test_ln', type: 'MA-16', data: { op: 'LN' } } as any;
    const resultLn = await NodeRegistry.evaluate(nodeLn, { in: inputE });
    const valLn = PayloadUtils.unwrap(resultLn);
    const passLn = Math.abs(Number(valLn) - 1) < 1e-9;
    console.log(`[LN] ln(e) = ${valLn} (Expected: 1) -> ${passLn ? '✅ PASS' : '❌ FAIL'}`);

    // 2. Test Log10
    const nodeLog10 = { id: 'test_log10', type: 'MA-16', data: { op: 'LOG10' } } as any;
    const resultLog10 = await NodeRegistry.evaluate(nodeLog10, { in: input100 });
    const valLog10 = PayloadUtils.unwrap(resultLog10);
    const passLog10 = Math.abs(Number(valLog10) - 2) < 1e-9;
    console.log(`[LOG10] log10(100) = ${valLog10} (Expected: 2) -> ${passLog10 ? '✅ PASS' : '❌ FAIL'}`);

    // 3. Test Log_n (Base 2)
    const nodeLogN = { id: 'test_logn', type: 'MA-16', data: { op: 'LOG_N' } } as any;
    const resultLogN = await NodeRegistry.evaluate(nodeLogN, { in: input8, base: base2 });
    const valLogN = PayloadUtils.unwrap(resultLogN);
    const passLogN = Math.abs(Number(valLogN) - 3) < 1e-9;
    console.log(`[LOG_N] log2(8) = ${valLogN} (Expected: 3) -> ${passLogN ? '✅ PASS' : '❌ FAIL'}`);

    if (passLn && passLog10 && passLogN) {
        console.log('✨ ALL TESTS PASSED');
    } else {
        console.log('💀 SOME TESTS FAILED');
    }
}

verifyLogNode().catch(console.error);
