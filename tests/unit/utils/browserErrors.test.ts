import { describe, expect, it } from 'vitest';
import { isBenignBrowserError } from '@/utils/browserErrors';

describe('browserErrors.isBenignBrowserError', () => {
    it('ignores ResizeObserver loop notifications', () => {
        expect(
            isBenignBrowserError('ResizeObserver loop completed with undelivered notifications.')
        ).toBe(true);
        expect(isBenignBrowserError('ResizeObserver loop limit exceeded')).toBe(true);
    });

    it('keeps real errors reportable', () => {
        expect(isBenignBrowserError('Global Error: Cannot read properties of undefined')).toBe(false);
        expect(isBenignBrowserError('ResizeObserver is not defined')).toBe(false);
        expect(isBenignBrowserError('')).toBe(false);
    });
});
