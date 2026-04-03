import { describe, test, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { DataType } from '@/types/payload';
import { NerdamerService } from '@/engine/calculus/NerdamerService';
import { RuntimeGuard } from '@/engine/calculus/RuntimeGuard';

describe('Calculus Nodes (CL-01 to CL-04)', () => {
    beforeEach(() => {
        NodeRegistry.initializeNodes();
    });

    // ─── CL-01: Derivative ───────────────────────────────────────────
    describe('CL-01: Derivative', () => {
        test('should differentiate x^2 to 2*x', async () => {
            const node = {
                id: 'deriv-1',
                type: 'CL-01',
                data: { variable: 'x', order: 1 },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createString('x^2')
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(result.type).toBe(DataType.Symbolic);
            expect(result.value).toBe('2*x');
        });

        test('should return 0 for derivative of constant', async () => {
            const node = {
                id: 'deriv-2',
                type: 'CL-01',
                data: { variable: 'x', order: 1 },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createScalar(5)
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(result.type).toBe(DataType.Scalar);
            expect(PayloadUtils.unwrap(result)).toBe(0);
        });
    });

    // ─── CL-02: Integral ─────────────────────────────────────────────
    describe('CL-02: Integral', () => {
        test('should compute indefinite integral ∫x dx = x²/2', async () => {
            const node = {
                id: 'int-1',
                type: 'CL-02',
                data: { variable: 'x', mode: 'INDEFINITE' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createString('x')
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(result.type).toBe(DataType.Symbolic);
            expect(result.value).toMatch(/0\.5\*x\^2|1\/2\*x\^2/);
        });

        test('should compute definite integral ∫₀⁵ 1 dx = 5', async () => {
            const node = {
                id: 'int-2',
                type: 'CL-02',
                data: { variable: 'x', mode: 'DEFINITE', lower: 0, upper: 5 },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createScalar(1)
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toBe(5);
        });
    });

    // ─── CL-04: Equation Solver ──────────────────────────────────────
    describe('CL-04: Equation Solver', () => {
        test('should solve simple equation x+3=5', async () => {
            const node = {
                id: 'solver-1',
                type: 'CL-04',
                data: { variable: 'x' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createString('x+3=5')
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([2]);
        });

        test('should solve system x=2, y=3+x for y', async () => {
            const node = {
                id: 'solver-2',
                type: 'CL-04',
                data: { variable: 'y' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': [
                    PayloadUtils.createString('x=2'),
                    PayloadUtils.createString('y=3+x')
                ] as any
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([5]);
        });

        test('should handle labeled inputs automatically', async () => {
            const node = {
                id: 'solver-3',
                type: 'CL-04',
                data: { variable: 'y' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': [
                    PayloadUtils.createString('y=3+x'),
                    { ...PayloadUtils.createScalar(2), meta: { label: 'x' } }
                ] as any
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([5]);
        });

        test('should hunt equations in arbitrary handle names (Robust Fallback)', async () => {
            const node = {
                id: 'solver-robust',
                type: 'CL-04',
                data: { variable: 'x' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'random_name_1': PayloadUtils.createSymbolic('x+3=6'),
                'another_input': PayloadUtils.createString('y=5')
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([3]);
        });

        test('should not crash on object input', async () => {
            const node = {
                id: 'solver-crash-test',
                type: 'CL-04',
                data: { variable: 'x' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_0': PayloadUtils.createString('x+3=5'),
                'bad_in': { type: DataType.Array, value: { foo: 'bar' }, meta: {}, symbol: null } as any
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([2]);
        });

        test('should handle single assignment solve for x=2', async () => {
            const node = {
                id: 'solver-single-assign',
                type: 'CL-04',
                data: { variable: 'x' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createString('x=2')
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([2]);
        });

        test('should solve system with multiple inputs on same handle (capsule behavior)', async () => {
            const node = {
                id: 'solver-capsule-test',
                type: 'CL-04',
                data: { variable: 'y' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': [
                    PayloadUtils.createString('x=2'),
                    PayloadUtils.createString('y=3+x')
                ] as any
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([5]);
        });

        test('should return empty array instead of [0] when no solution exists', async () => {
            const node = {
                id: 'solver-no-sol',
                type: 'CL-04',
                data: { variable: 'z' }, // z is not in the equations
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createString('x+y=5')
            };

            const result = await NodeRegistry.evaluate(node, inputs);
            const val = PayloadUtils.unwrap(result);
            expect(val).toEqual([]);
        });

        test('should return different answers when switching target variable for x+y=5', async () => {
            const nodeX = {
                id: 'solver-switch-x',
                type: 'CL-04',
                data: { variable: 'x' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const inputs = {
                'in_a': PayloadUtils.createString('x+y=5')
            };

            const resultX = await NodeRegistry.evaluate(nodeX, inputs);
            const valX = String(PayloadUtils.unwrap(resultX));
            expect(valX).toContain('y');

            const nodeY = { ...nodeX, id: 'solver-switch-y', data: { variable: 'y' } };
            const resultY = await NodeRegistry.evaluate(nodeY, inputs);
            const valY = String(PayloadUtils.unwrap(resultY));
            expect(valY).toContain('x');
        });

        test('should resolve system x=2, y=3+x for both x and y', async () => {
            const inputs = {
                'in_a': [
                    PayloadUtils.createString('x=2'),
                    PayloadUtils.createString('y=3+x')
                ] as any
            };

            const nodeY = {
                id: 'solver-sys-y',
                type: 'CL-04',
                data: { variable: 'y' },
                value: undefined,
                selected: false,
                isInDirtyChain: false,
                position: { x: 0, y: 0 }
            };

            const resultY = await NodeRegistry.evaluate(nodeY, inputs);
            expect(PayloadUtils.unwrap(resultY)).toEqual([5]);

            const nodeX = { ...nodeY, id: 'solver-sys-x', data: { variable: 'x' } };
            const resultX = await NodeRegistry.evaluate(nodeX, inputs);
            expect(PayloadUtils.unwrap(resultX)).toEqual([2]);
        });

        // ── Complex Test 1: 3-variable linear system ─────────────────
        // x+y+z=6, 2x-y+z=3, x+2y-z=2  →  x=1, y=2, z=3
        test('should solve 3-variable linear system for each variable', async () => {
            const mkNode = (id: string, v: string) => ({
                id, type: 'CL-04', data: { variable: v },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            });

            const inputs = {
                'in_a': [
                    PayloadUtils.createString('x+y+z=6'),
                    PayloadUtils.createString('2*x-y+z=3'),
                    PayloadUtils.createString('x+2*y-z=2')
                ] as any
            };

            const rx = await NodeRegistry.evaluate(mkNode('sys3-x', 'x'), inputs);
            expect(PayloadUtils.unwrap(rx)).toEqual([1]);

            const ry = await NodeRegistry.evaluate(mkNode('sys3-y', 'y'), inputs);
            expect(PayloadUtils.unwrap(ry)).toEqual([2]);

            const rz = await NodeRegistry.evaluate(mkNode('sys3-z', 'z'), inputs);
            expect(PayloadUtils.unwrap(rz)).toEqual([3]);
        });

        // ── Complex Test 2: Quadratic — two roots ─────────────────────
        // x^2 + x - 6 = 0  →  roots: x=2, x=-3
        test('should find both roots of x^2 + x - 6 = 0', async () => {
            const node = {
                id: 'quad-roots', type: 'CL-04', data: { variable: 'x' },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            };
            const inputs = { 'in_a': PayloadUtils.createString('x^2+x-6=0') };
            const result = await NodeRegistry.evaluate(node, inputs);
            const val = PayloadUtils.unwrap(result) as any[];
            const nums = val.map(Number).sort((a, b) => a - b);
            expect(nums).toEqual([-3, 2]);
        });

        test('should warn for quadratic equation with Unicode x²', async () => {
            const node = {
                id: 'unicode-quad', type: 'CL-04', data: { variable: 'x' },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            };
            const inputs = { 'in_a': PayloadUtils.createString('x² + x - 6 = 0') };
            const result = await NodeRegistry.evaluate(node, inputs);
            expect(result.type).toBe(DataType.Error);
            expect(result.meta?.error).toContain('Unicode detected');
        });

        // ── Complex Test 3: Multi-equation substitution ───────────────
        // 2a + b = 10, b = 4  →  a = 3 and b = 4
        test('should solve 2a+b=10, b=4 for a and b', async () => {
            const mkNode = (id: string, v: string) => ({
                id, type: 'CL-04', data: { variable: v },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            });

            const inputs = {
                'in_a': [
                    PayloadUtils.createString('2*a+b=10'),
                    PayloadUtils.createString('b=4')
                ] as any
            };

            const ra = await NodeRegistry.evaluate(mkNode('sub-a', 'a'), inputs);
            expect(PayloadUtils.unwrap(ra)).toEqual([3]);

            const rb = await NodeRegistry.evaluate(mkNode('sub-b', 'b'), inputs);
            expect(PayloadUtils.unwrap(rb)).toEqual([4]);
        });

        // ── Smart Formatting & Deduplication Tests ───────────────────
        test('should deduplicate redundant roots for (x-2)^2 = 0', async () => {
            const node = {
                id: 'redundant-root', type: 'CL-04', data: { variable: 'x' },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            };
            const inputs = { 'in_a': PayloadUtils.createString('(x-2)^2=0') };
            const result = await NodeRegistry.evaluate(node, inputs);
            expect(PayloadUtils.unwrap(result)).toEqual([2]);
        });

        test('should cap and sort transcendental solutions for sin(x)=0', async () => {
            const node = {
                id: 'transcendental-sin', type: 'CL-04', data: { variable: 'x' },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            };
            const inputs = { 'in_a': PayloadUtils.createString('sin(x)=0') };
            const result = await NodeRegistry.evaluate(node, inputs);
            const val = PayloadUtils.unwrap(result) as number[];
            expect(val.length).toBeLessThanOrEqual(6);
            // Should contain 0 and be sorted by absolute value
            expect(val[0]).toBe(0);
            expect(Math.abs(val[1])).toBeCloseTo(Math.PI, 4);
        });

        test('should merge numerically similar solutions (precision merging)', async () => {
            const node = {
                id: 'precision-merge', type: 'CL-04', data: { variable: 'x' },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            };
            const inputsComplex = { 'in_a': [PayloadUtils.createString('x=2.00000001'), PayloadUtils.createString('x=2')] as any };
            const resComplex = await NodeRegistry.evaluate(node, inputsComplex);
            expect(PayloadUtils.unwrap(resComplex)).toEqual([2]);
        });

        test('should format complex approximations as clean decimals (e^x=5)', async () => {
            const node = {
                id: 'exp-approx', type: 'CL-04', data: { variable: 'x' },
                value: undefined, selected: false, isInDirtyChain: false, position: { x: 0, y: 0 }
            };
            const inputs = { 'in_a': PayloadUtils.createString('e^x=5') };
            const result = await NodeRegistry.evaluate(node, inputs);
            const val = PayloadUtils.unwrap(result) as number[];
            expect(val[0]).toBeCloseTo(Math.log(5), 6);
            expect(String(val[0])).not.toContain('/'); // Should not be a fraction string
        });
    });
});

// ─── CL-05: ODE Solver ─────────────────────────────────────────
describe('CL-05: ODE Solver', () => {
    test('should solve dy/dt = -y (exponential decay, y(0)=1)', async () => {
        const node = {
            id: 'test-ode',
            type: 'CL-05',
            data: { method: 'RK4', t0: 0, tEnd: 1, y0: 1, stepSize: 0.01 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in_a': PayloadUtils.createString('-y')
        };

        const result = await NodeRegistry.evaluate(node, inputs);
        const val = PayloadUtils.unwrap(result);

        expect(Array.isArray(val)).toBe(true);
        if (Array.isArray(val) && val.length > 0) {
            const lastPoint = val[val.length - 1];
            expect(lastPoint[1]).toBeCloseTo(Math.exp(-1), 2);
        }
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


