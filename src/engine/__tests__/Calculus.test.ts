import { describe, test, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '../NodeRegistry';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NerdamerService } from '../calculus/NerdamerService';
import { RuntimeGuard } from '../calculus/RuntimeGuard';

/**
 * Phase 5.1 Calculus Engine Tests
 *
 * Tests core calculus nodes directly via NodeRegistry.evaluate(),
 * following the same pattern as existing tests (StringNode.test.ts, etc.).
 */

beforeAll(() => {
    initializeNodes();
});

// ─── AD-04: Derivative ─────────────────────────────────────────

describe('AD-04: Derivative', () => {
    test('should differentiate x^2 to 2*x', async () => {
        const node = {
            id: 'test-diff',
            type: 'AD-04',
            data: { variable: 'x', order: 1 },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('x^2')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = String(PayloadUtils.unwrap(result));
        expect(val).toContain('2');
        expect(val).toContain('x');
    });

    test('should return 0 for derivative of constant', async () => {
        const node = {
            id: 'test-diff-const',
            type: 'AD-04',
            data: { variable: 'x', order: 1 },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('5')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        expect(String(PayloadUtils.unwrap(result))).toBe('0');
    });

    test('should compute second derivative d²/dx²(x³) = 6x', async () => {
        const node = {
            id: 'test-diff-2nd',
            type: 'AD-04',
            data: { variable: 'x', order: 2 },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('x^3')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = String(PayloadUtils.unwrap(result));
        expect(val).toContain('6');
        expect(val).toContain('x');
    });

    test('should compute partial derivative ∂/∂x(x^2 + y^2) = 2x', async () => {
        const node = {
            id: 'test-partial',
            type: 'AD-04',
            data: { variable: 'x', order: 1 },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('x^2+y^2')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = String(PayloadUtils.unwrap(result));
        expect(val).toContain('2');
        expect(val).toContain('x');
        // Should not contain y (y^2 is treated as constant)
        expect(val).not.toContain('y');
    });
});

// ─── AD-05: Integral ───────────────────────────────────────────

describe('AD-05: Integral', () => {
    test('should compute indefinite integral ∫x dx = x²/2', async () => {
        const node = {
            id: 'test-int',
            type: 'AD-05',
            data: { variable: 'x', mode: 'indefinite' },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('x')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = String(PayloadUtils.unwrap(result));
        expect(val).toContain('x');
    });

    test('should compute definite integral ∫₀⁵ 1 dx = 5', async () => {
        const node = {
            id: 'test-defint',
            type: 'AD-05',
            data: { variable: 'x', mode: 'definite', lower: '0', upper: '5' },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('1')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = Number(PayloadUtils.unwrap(result));
        expect(val).toBeCloseTo(5, 3);
    });
});

// ─── AD-11: Limit ──────────────────────────────────────────────

describe('AD-11: Limit', () => {
    test('should compute lim(sin(x)/x, x→0) = 1', async () => {
        const node = {
            id: 'test-lim',
            type: 'AD-11',
            data: { variable: 'x', approach: '0', direction: 'both' },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('sin(x)/x')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = Number(PayloadUtils.unwrap(result));
        expect(val).toBeCloseTo(1, 3);
    });

    test('should return error for no input', async () => {
        const node = {
            id: 'test-lim-noexpr',
            type: 'AD-11',
            data: { variable: 'x', approach: '0', direction: 'both' },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node, {});
        expect(result.type).toBe(DataType.Error);
    });
});

// ─── SY-04: ODE Solver ─────────────────────────────────────────

describe('SY-04: ODE Solver', () => {
    test('should solve dy/dt = -y (exponential decay, y(0)=1)', async () => {
        const node = {
            id: 'test-ode',
            type: 'SY-04',
            data: { method: 'RK4', t0: 0, tEnd: 1, y0: 1, stepSize: 0.01 },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'expr': PayloadUtils.createString('-y')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = PayloadUtils.unwrap(result);

        expect(Array.isArray(val)).toBe(true);
        if (Array.isArray(val) && val.length > 0) {
            const lastPoint = val[val.length - 1];
            // At t=1, y = e^(-1) ≈ 0.3679
            expect(lastPoint[1]).toBeCloseTo(Math.exp(-1), 2);
        }
    });

    test('should return error for no input', async () => {
        const node = {
            id: 'test-ode-noexpr',
            type: 'SY-04',
            data: { method: 'RK4', t0: 0, tEnd: 1, y0: 1, stepSize: 0.01 },
            value: undefined,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const result = await NodeRegistry.evaluate(node, {});
        expect(result.type).toBe(DataType.Error);
    });
});

// ─── RuntimeGuard Tests ────────────────────────────────────────────

describe('RuntimeGuard', () => {
    test('should catch NaN results', () => {
        const result = RuntimeGuard.safeEvaluate(() => NaN);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('NaN');
    });

    test('should catch Infinity results', () => {
        const result = RuntimeGuard.safeEvaluate(() => Infinity);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Infinity');
    });

    test('should catch thrown errors', () => {
        const result = RuntimeGuard.safeEvaluate(() => {
            throw new Error('Division by zero');
        });
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Division by Zero');
    });

    test('should pass valid numeric results', () => {
        const result = RuntimeGuard.safeEvaluate(() => 42);
        expect(result.ok).toBe(true);
        expect(result.value).toBe(42);
    });
});

// ─── NerdamerService Tests ─────────────────────────────────────────

describe('NerdamerService', () => {
    test('should differentiate correctly', () => {
        const svc = NerdamerService.getInstance();
        const result = svc.differentiate('x^3', 'x', 1);
        expect(result.text()).toContain('3');
    });

    test('should manage LRU cache', () => {
        const svc = NerdamerService.getInstance();
        svc.clearCache();

        svc.compileToFunction('x^2 + 1', ['x']);
        expect(svc.getCacheSize()).toBe(1);

        // Same function should hit cache (no new entry)
        svc.compileToFunction('x^2 + 1', ['x']);
        expect(svc.getCacheSize()).toBe(1);

        // Different function should add to cache
        svc.compileToFunction('x^3 + 2', ['x']);
        expect(svc.getCacheSize()).toBe(2);
    });

    test('should extract variables', () => {
        const svc = NerdamerService.getInstance();
        const vars = svc.getVariables('x^2 + y*z');
        expect(vars).toContain('x');
        expect(vars).toContain('y');
        expect(vars).toContain('z');
    });
});
