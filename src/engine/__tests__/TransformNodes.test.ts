import { describe, test, expect } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { InputOutputEngine } from '../InputOutputEngine';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';

describe('TR-05: Smoothing', () => {
    test('should smooth a 1D array using moving average', async () => {
        const node = {
            id: 'smooth-1d',
            type: 'TR-05',
            data: { windowMode: 3 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'data': PayloadUtils.createArray([10, 20, 10, 20, 10])
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const val = PayloadUtils.unwrap(result) as number[];
        
        // Expected:
        // i=0: (10+20)/2 = 15
        // i=1: (10+20+10)/3 = 13.33
        // i=2: (20+10+20)/3 = 16.67
        // i=3: (10+20+10)/3 = 13.33
        // i=4: (20+10)/2 = 15
        expect(val[0]).toBe(15);
        expect(val[1]).toBeCloseTo(13.33, 2);
    });

    test('TR-05: should smooth a column vector (7x1 matrix)', async () => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        const node = {
            id: 'smooth-col',
            type: 'TR-05',
            data: { windowSize: 3 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        // [[0],[10],[0],[10],[0],[10],[0]]
        const colVec = math.matrix([[0], [10], [0], [10], [0], [10], [0]]);
        const inputs = {
            'data': PayloadUtils.wrap(colVec)
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const out = PayloadUtils.unwrap(result) as any;
        const arr = out.data || out; // Handle dehydrated Matrix object
        
        // Window size 3:
        // [0] -> avg([0, 10]) = 5
        // [10] -> avg([0, 10, 0]) = 3.33...
        // [0] -> avg([10, 0, 10]) = 6.66...
        expect(arr[0][0]).toBeCloseTo(5);
        expect(arr[1][0]).toBeCloseTo(3.333, 2);
        expect(arr[2][0]).toBeCloseTo(6.666, 2);
    });

    test('should smooth using static windowMode parameter', async () => {
        const node = {
            id: 'smooth-win',
            type: 'TR-05',
            data: { windowMode: 5 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };
 
        const inputs = {
            'data': PayloadUtils.createArray([1, 1, 1, 10, 10])
        };
 
        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const val = PayloadUtils.unwrap(result) as number[];
        // With window 5:
        // Index 2: (1+1+1+10+10)/5 = 23/5 = 4.6
        expect(val[2]).toBe(4.6);
    });
});

describe('TR-04: Vector Field', () => {
    test('should compute gradient for f(x,y)=x^2+y^2', async () => {
        const node = {
            id: 'vec-grad',
            type: 'TR-04',
            data: { mode: 'gradient', var1: 'x', var2: 'y' },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in_f': PayloadUtils.createSymbolic('x^2 + y^2')
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        expect(result.type).toBe(DataType.Array);
        
        const resObj = result.value as any;
        expect(resObj.out_symbolic).toBeDefined();
        expect(resObj.out_field).toBeDefined();

        const grad = PayloadUtils.unwrap(resObj.out_symbolic) as string;
        expect(grad).toContain('2*x');
        expect(grad).toContain('2*y');
        expect(grad).toContain('[');
        expect(grad).toContain(']');

        const field = PayloadUtils.unwrap(resObj.out_field) as any[][];
        expect(field.length).toBeGreaterThan(0);
        // Point (1, 1) should have grad (2, 2)
        const p11 = field.find(p => p[0] === 1 && p[1] === 1);
        expect(p11).toBeDefined();
        expect(p11![2]).toBe(2); // vx
        expect(p11![3]).toBe(2); // vy
    });

    test('should use configurable range and density', async () => {
        const node = {
            id: 'vec-config',
            type: 'TR-04',
            data: { 
                mode: 'gradient', 
                var1: 'x', 
                var2: 'y',
                min: 0,
                max: 10,
                density: 5 // step = 10 / 5 = 2. Points: 0, 2, 4, 6, 8, 10
            },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in_f': PayloadUtils.createSymbolic('x + y')
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const resObj = result.value as any;
        const field = PayloadUtils.unwrap(resObj.out_field) as any[][];

        // Density 5 over [0, 10] means 6 points (0, 2, 4, 6, 8, 10) per axis
        // Total 6 * 6 = 36 points
        expect(field.length).toBe(36);
        
        // Grad of x + y is (1, 1)
        expect(field[0][2]).toBe(1); // vx
        expect(field[0][3]).toBe(1); // vy

        // Check range
        const xs = field.map(p => p[0]);
        expect(Math.min(...xs)).toBe(0);
        expect(Math.max(...xs)).toBe(10);
        expect(xs).toContain(2);
        expect(xs).not.toContain(1);
    });

    test('should compute divergence for [x, y]', async () => {
        const node = {
            id: 'vec-div',
            type: 'TR-04',
            data: { mode: 'divergence', var1: 'x', var2: 'y' },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in_p': PayloadUtils.createSymbolic('x'),
            'in_q': PayloadUtils.createSymbolic('y')
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const resObj = result.value as any;
        const out = PayloadUtils.unwrap(resObj.out_symbolic);
        // div([x,y]) = d/dx(x) + d/dy(y) = 1 + 1 = 2
        // Nerdamer might return '(1)+(1)'
        expect(String(out).replace(/\(|\)/g, '')).toBe('1+1');
    });

    test('should compute curl for [ -y, x ]', async () => {
        const node = {
            id: 'vec-curl',
            type: 'TR-04',
            data: { mode: 'curl', var1: 'x', var2: 'y' },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in_p': PayloadUtils.createSymbolic('-y'),
            'in_q': PayloadUtils.createSymbolic('x')
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const resObj = result.value as any;
        const out = PayloadUtils.unwrap(resObj.out_symbolic);
        // curl([-y, x]) = d/dx(x) - d/dy(-y) = 1 - (-1) = 2
        expect(String(out).replace(/\(|\)/g, '')).toBe('1--1');
    });

    test('should compute direct field for P=y, Q=x', async () => {
        const node = {
            id: 'vec-direct',
            type: 'TR-04',
            data: { mode: 'direct', var1: 'x', var2: 'y', min: 0, max: 2, density: 1 },
            value: undefined,
            selected: false,
            isInDirtyChain: false,
            position: { x: 0, y: 0 }
        };

        const inputs = {
            'in_p': PayloadUtils.createSymbolic('y'),
            'in_q': PayloadUtils.createSymbolic('x')
        };

        const result = await NodeRegistry.evaluate(node, inputs) as any;
        const resObj = result.value as any;
        const out = PayloadUtils.unwrap(resObj.out_symbolic);
        expect(out).toBe('[y, x]');
        const field = PayloadUtils.unwrap(resObj.out_field) as any[][];
        
        // (0,0) -> P=0, Q=0
        // (0,2) -> P=2, Q=0
        // (2,0) -> P=0, Q=2
        // (2,2) -> P=2, Q=2
        expect(field.length).toBe(4);
        const p22 = field.find(p => p[0] === 2 && p[1] === 2);
        expect(p22![2]).toBe(2); // P(2,2) = 2
        expect(p22![3]).toBe(2); // Q(2,2) = 2
    });
});
