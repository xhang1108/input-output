import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd().replace(/\\/g, '/');
const read = (p: string) => readFileSync(`${process.cwd()}/${p}`, 'utf8');

describe('S3 edge-perf subscriptions', () => {
    it('useRelink does not subscribe to s.edges; uses store.getState() in callbacks', () => {
        const src = read('src/hooks/useRelink.ts');
        expect(src).toContain('useStoreApi');
        expect(src).not.toMatch(/useStore\(\s*\(s\)\s*=>\s*s\.edges/);
        expect(src).toContain('store.getState().edges');
    });

    it('RelinkLine nodeLookup/transform read without subscription; s.edges kept', () => {
        const src = read('src/components/edges/RelinkLine.tsx');
        expect(src).not.toMatch(/useStore\(\s*\(s\)\s*=>\s*s\.nodeLookup/);
        expect(src).not.toMatch(/useStore\(\s*\(s\)\s*=>\s*s\.transform/);
        expect(src).toMatch(/useStore\(\s*\(s\)\s*=>\s*s\.edges/);
        expect(src).toContain('store.getState()');
    });

    it('useHandleMagnet reads nodeLookup without subscription', () => {
        const src = read('src/hooks/useHandleMagnet.ts');
        expect(src).not.toMatch(/useStore\(\s*\(s\)\s*=>\s*s\.nodeLookup/);
        expect(src).toContain('getState()');
    });

    it('MagneticEdge is memoized and uses O(1) slot lookup', () => {
        const src = read('src/components/edges/MagneticEdge.tsx');
        expect(src).toMatch(/export const MagneticEdge\s*=\s*memo\(/);
        expect(src).toContain('getEdgeSlotIndex');
        // render path must not call edges.filter
        const renderBody = src.slice(src.indexOf('myIndex'));
        void renderBody;
        const filterCalls = (src.match(/\.filter\(/g) ?? []).length;
        expect(filterCalls).toBe(0);
    });

    it('SolverNode avoids useNodes(); IOPlayground uses heightSig', () => {
        const solver = read('src/components/nodes/SolverNode.tsx');
        expect(solver).not.toContain('useNodes()');
        expect(solver).toContain('sourceIds');
        const wiki = read('src/app/wiki/IOPlayground.tsx');
        expect(wiki).toContain('heightSig');
        expect(wiki).not.toMatch(/useStore\(\(s: ReactFlowState\) => s\.nodeLookup\)/);
    });
});
