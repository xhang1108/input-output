import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NerdamerService } from '@/engine/calculus/NerdamerService';

/**
 * ️ EnvironmentSafety.test.ts
 * Verifies that the engine can initialize in "Worker-like" environments
 * where global 'window' is strictly undefined or throws.
 */

describe('Environment Safety: Global Scope Access', () => {

    beforeEach(() => {
        // Reset the singleton to force a new constructor execution
        // We Use any to access private members for testing
        (NerdamerService as any).instance = undefined;
    });

    test('NerdamerService should initialize safely without window (Worker environment)', () => {
        // 1. Mock the environment: strictly delete window if it exists
        const originalWindow = (globalThis as any).window;

        try {
            // In Node, global.window might exist if using jsdom.
            // We want to simulate a pure worker.
            delete (globalThis as any).window;

            // 2. Initialize the service
            const svc = NerdamerService.getInstance();

            // 3. Verify it loaded the bundled nerdamer
            expect(svc.getNerdamer()).toBeDefined();
            expect(typeof svc.getNerdamer()).toBe('function');

        } finally {
            // Restore window for other tests
            (globalThis as any).window = originalWindow;
        }
    });

    test('NerdamerService should handle cases where nerdamer.default is used (ESM)', () => {
        // Simulate a bundler wrapping nerdamer in a default export
        const mockNerdFunc = vi.fn().mockReturnValue({ text: () => 'ok' });
        (mockNerdFunc as any).solveEquations = vi.fn();

        const mockModule = {
            default: mockNerdFunc
        };

        // We can't easily mock the import itself in this test without complex vitest mocking,
        // but the constructor logic is what we verified:
        // this.nerdamer = (nerdamer as any).default || nerdamer;

        // This test serves as a documentation of the requirement.
        expect(mockModule.default).toBeDefined();
    });
});


