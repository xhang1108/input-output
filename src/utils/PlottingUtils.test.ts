import { describe, it, expect } from 'vitest';
import { PlottingUtils } from './PlottingUtils';

describe('PlottingUtils Phase 1', () => {
    describe('1.1 & 1.2 Symbolic Sampling and Asymptote Handling', () => {
        it('should linearly sample the function based on min/max and points', () => {
            const result = PlottingUtils.generateSymbolicPoints('2*x', 0, 10, 3);
            expect(result).toEqual([
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 20 },
            ]);
        });

        it('should handle asymptotes by injecting null', () => {
            // function 1/x has asymptote at 0
            const result = PlottingUtils.generateSymbolicPoints('1/x', -1, 1, 3);
            // x = -1, 0, 1
            expect(result[1].x).toBe(0);
            expect(result[1].y).toBeNull(); // 1/0 is Infinity, which is not finite
        });

        it('should inject 0 for unassigned variables in formulas like f(x, a)', () => {
            // formula depends on x and a. Default a = 0.
            const result = PlottingUtils.generateSymbolicPoints('x + a', 0, 10, 2);
            expect(result).toEqual([
                { x: 0, y: 0 },
                { x: 10, y: 10 }
            ]);
        });
    });

    describe('1.3 Adapter Mapping', () => {
        it('should parse Scalar numbers', () => {
            const result = PlottingUtils.mapDataPayload(42);
            expect(result).toEqual([{ x: 0, y: 42 }]);
        });

        it('should parse Matrix Nx1 arrays', () => {
            const result = PlottingUtils.mapDataPayload([10, 20, 30]);
            expect(result).toEqual([
                { x: 0, y: 10 },
                { x: 1, y: 20 },
                { x: 2, y: 30 }
            ]);
        });

        it('should parse Matrix Nx2 arrays', () => {
            // 2D arrays mapping direct to X/Y
            const result = PlottingUtils.mapDataPayload([
                [0, 5],
                [1, 10]
            ]);
            expect(result).toEqual([
                { x: 0, y: 5 },
                { x: 1, y: 10 }
            ]);
        });

        it('should parse Matrix Nx3 arrays and correctly extract size', () => {
            // Bubble mapping: X, Y, Size
            const result = PlottingUtils.mapDataPayload([
                [0, 5, 100],
                [1, 10, 200]
            ]);
            expect(result).toEqual([
                { x: 0, y: 5, size: 100 },
                { x: 1, y: 10, size: 200 }
            ]);
        });

        it('should support mathjs Matrix pseudo-interface format', () => {
            const mockMatrix = {
                toArray: () => [
                    [1, 2],
                    [3, Infinity] // test asymptote mapping inside matrix
                ]
            };
            const result = PlottingUtils.mapDataPayload(mockMatrix);
            expect(result).toEqual([
                { x: 1, y: 2 },
                { x: 3, y: null }
            ]);
        });
    });
});
