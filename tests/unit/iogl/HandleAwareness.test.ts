import { Parser } from '@/iogl/Parser';
import { describe, it, expect } from 'vitest';

describe('IOGL Handle Awareness', () => {
    it('should fail when linking to a non-existent handle in INV mode (DT-06)', () => {
        const script = `
        [calc] DT-06(INV)
        [res] OT-01
        [calc].b -> [res].a
        `;
        const parser = new Parser(script);
        const { diagnostics } = parser.parse();
        
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain("does not have output handle '.b'");
    });

    it('should pass when linking to .b in QR mode (DT-06)', () => {
        const script = `
        [calc] DT-06(QR)
        [res] OT-01
        [calc].b -> [res].a
        `;
        const parser = new Parser(script);
        const { diagnostics } = parser.parse();
        
        expect(diagnostics.length).toBe(0);
    });

    it('should fail when using second input for ABS (MA-02)', () => {
        const script = `
        [a] IN-01(5)
        [b] MA-02(ABS)
        [a] -> [b].b
        `;
        const parser = new Parser(script);
        const { diagnostics } = parser.parse();

        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain("does not have input handle '.b'");
    });

    it('should pass for legitimate second input in POW (MA-02)', () => {
        const script = `
        [a] IN-01(5)
        [b] MA-02(POW)
        [a] -> [b].b
        `;
        const parser = new Parser(script);
        const { diagnostics } = parser.parse();

        expect(diagnostics.length).toBe(0);
    });

    it('should fail when using non-existent handle on a static node (IN-01.b)', () => {
        const script = `
        [a] IN-01(5)
        [b] OT-01
        [a].b -> [b].a
        `;
        const parser = new Parser(script);
        const { diagnostics } = parser.parse();

        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain("does not have output handle '.b'");
    });
});

