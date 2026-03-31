import { test, expect } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';

test('Manual Verification: Gaussian Field Gradient', async () => {
    console.log('--- Starting Manual Verification ---');

    // Initialize registry
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
        'in_a': PayloadUtils.createSymbolic('e^{-(x^2 + y^2)}')
    };

    console.log('Evaluating Gaussian Field Gradient...');
    const result = await NodeRegistry.evaluate(node, inputs) as any;

    const resObj = result.value as any;
    const out_b = PayloadUtils.unwrap(resObj.out_b);
    const out_a = PayloadUtils.unwrap(resObj.out_a) as any[][];

    console.log('Symbolic Result (Gradient):', out_b);
    console.log('Sampling Density Check:', out_a.length);

    // Total points for density 10 from -5 to 5 is (10+1)^2 = 121
    expect(out_a.length).toBe(121);

    // Verify a specific point, e.g., (1, 1)
    const p11 = out_a.find(p => p[0] === 1 && p[1] === 1);
    expect(p11).toBeDefined();

    if (p11) {
        console.log('Point (1, 1) -> vx:', p11[2], 'vy:', p11[3]);

        // Manual sanity check for math:
        // f = exp(-x^2-y^2)
        // df/dx = -2x * exp(-x^2-y^2)
        // At (1,1): -2 * 1 * exp(-1-1) = -2 * e^-2 ≈ -0.2706705664732254
        const expected = -2 * Math.exp(-2);
        console.log('Expected (Calculated at Runtime):', expected);

        expect(p11[2]).toBeCloseTo(expected, 10);
        expect(p11[3]).toBeCloseTo(expected, 10);

        console.log('Gaussian Gradient Verification PASSED');
    }

    console.log('--- Verification Complete ---');
});
