import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';

async function verify() {
    console.log('--- Starting Manual Verification ---');

    // Initialize registry (required for AdvancedEvaluators)
    console.log('Initializing Node Registry...');
    NodeRegistry.initializeNodes();

    const node = {
        id: 'test-node',
        type: 'TR-04',
        data: { mode: 'gradient', var1: 'x', var2: 'y', min: -5, max: 5, density: 10 },
        value: undefined,
        selected: false,
        isInDirtyChain: false,
        position: { x: 0, y: 0 }
    } as any;

    // Case: f(x, y) = e^{-(x^2 + y^2)}
    const inputs = {
        'in_f': PayloadUtils.createSymbolic('e^{-(x^2 + y^2)}')
    };

    console.log('Evaluating Gaussian Field Gradient...');
    const result = await NodeRegistry.evaluate(node, inputs) as any;

    const resObj = result.value as any;
    const out_symbolic = PayloadUtils.unwrap(resObj.out_symbolic);
    const out_field = PayloadUtils.unwrap(resObj.out_field) as any[][];

    console.log('Symbolic Result (Gradient):', out_symbolic);
    console.log('Sampling Density Check:', out_field.length, '(Expected 121 for 10 density inclusive of boundaries)');

    // Verify a specific point, e.g., (1, 1)
    const p11 = out_field.find(p => p[0] === 1 && p[1] === 1);
    if (p11) {
        console.log('Point (1, 1) -> vx:', p11[2], 'vy:', p11[3]);

        // Manual sanity check for math:
        // f = exp(-x^2-y^2)
        // df/dx = -2x * exp(-x^2-y^2)
        // At (1,1): -2 * 1 * exp(-1-1) = -2 * e^-2 ≈ -0.2706705664732254
        const expected = -2 * Math.exp(-2);
        console.log('Expected (Calculated at Runtime):', expected);

        const diffX = Math.abs(p11[2] - (expected as any));
        const diffY = Math.abs(p11[3] - (expected as any));

        if (diffX < 1e-10 && diffY < 1e-10) {
            console.log('Gaussian Gradient Verification PASSED');
        } else {
            console.log('Calculation mismatch:', { diffX, diffY });
            console.log('(Note: Floating point differences expected if using high precision)');
        }
    } else {
        console.log('Point (1, 1) not found in samples');
    }

    console.log('--- Verification Complete ---');
}

verify().catch(e => {
    console.error('--- Verification CRASHED ---');
    console.error(e);
});
