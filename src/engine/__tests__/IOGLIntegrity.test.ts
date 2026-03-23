import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GraphCodec } from '../GraphCodec';

describe('IOGL Integrity', () => {
    // Determine the examples directory relative to this test file or process root
    const examplesDir = path.resolve(process.cwd(), 'public/examples');

    if (!fs.existsSync(examplesDir)) {
        it.skip('Examples directory not found (skipping)', () => {});
        return;
    }

    const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.iogl'));

    if (files.length === 0) {
        it('should have at least one example file', () => {
            // This is a sanity check to ensure we are looking in the right place
            expect(files.length).toBeGreaterThan(0);
        });
    }

    files.forEach(file => {
        it(`should validate ${file}`, () => {
            const content = fs.readFileSync(path.join(examplesDir, file), 'utf-8');
            const { diagnostics, graph } = GraphCodec.parse(content);
            
            // 1. Check for parsing errors
            if (diagnostics.length > 0) {
                console.error(`Validation failed for ${file}:`, diagnostics);
            }
            expect(diagnostics).toHaveLength(0);

            // 2. Check for basic structural integrity
            expect(graph.nodes).toBeDefined();
            expect(graph.edges).toBeDefined();
            expect(Array.isArray(graph.nodes)).toBe(true);
            expect(Array.isArray(graph.edges)).toBe(true);

            // 3. Ensure all nodes have IDs and types
            graph.nodes.forEach(node => {
                expect(node.id).toBeDefined();
                expect(node.type).toBeDefined();
            });

            // 4. Ensure all edges point to existing nodes
            const nodeIds = new Set(graph.nodes.map(n => n.id));
            graph.edges.forEach(edge => {
                expect(nodeIds.has(edge.source)).toBe(true);
                expect(nodeIds.has(edge.target)).toBe(true);
            });
        });
    });
});
