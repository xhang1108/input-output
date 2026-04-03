import { describe, it, expect } from 'vitest';
import { getUniqueLabel } from '@/utils/labelUtils';

describe('labelUtils', () => {
    it('should format unique labels with the new hyphen-only suffix', () => {
        const existing = ['Math'];
        expect(getUniqueLabel('Math', existing)).toBe('Math-01');
    });

    it('should increment existing hyphen suffixes correctly', () => {
        const existing = ['Math'];
        expect(getUniqueLabel('Math', existing)).toBe('Math-01');
        
        const existing2 = ['Math', 'Math-01'];
        expect(getUniqueLabel('Math', existing2)).toBe('Math-02');
        expect(getUniqueLabel('Math', existing2)).toBe('Math-02');
        
        const existing3 = ['Math-01'];
        expect(getUniqueLabel('Math-01', existing3)).toBe('Math-02');
    });

    it('should correctly handle transition from old format to new format', () => {
        // If "Math - 01" exists and we suggest "Math", it shouldn't match "Math - 01" as a suffix
        // because we updated the regex. So it should suggest "Math-01".
        const existing = ['Math', 'Math - 01'];
        expect(getUniqueLabel('Math', existing)).toBe('Math-01');
    });

    it('should handle multi-digit increments', () => {
        const existing = ['Math-01', 'Math-02', 'Math-03'];
        expect(getUniqueLabel('Math-01', existing)).toBe('Math-04');
    });

    it('should be case-insensitive when checking uniqueness', () => {
        const existing = ['Math'];
        expect(getUniqueLabel('math', existing)).toBe('math-01');
        
        const existing2 = ['MATH', 'MATH-01'];
        expect(getUniqueLabel('Math', existing2)).toBe('Math-02');
    });
});


