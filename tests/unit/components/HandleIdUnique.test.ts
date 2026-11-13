/**
 * P2-11: Handle id uniqueness.
 *
 * - Every NODE_DEFINITIONS entry must use unique handle ids within the node.
 * - `assertUniqueHandleIds` (dev-only guard used by SingleHandle/CapsuleHandle)
 *   must throw on a duplicate-id fixture.
 */
import { describe, it, expect } from 'vitest';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { assertUniqueHandleIds } from '@/utils/handleUtils';

describe('HandleIdUnique', () => {
    it('all static node definitions use unique handle ids per node', () => {
        for (const def of NODE_DEFINITIONS) {
            const ids = (def.handles ?? []).map((h) => h.id);
            expect(new Set(ids).size, `duplicate handle id in node ${def.id}`).toBe(ids.length);
            // The runtime guard must also accept them.
            expect(() => assertUniqueHandleIds(def.handles ?? [], def.id)).not.toThrow();
        }
    });

    it('duplicate handle ids fail (dev-only guard)', () => {
        expect(() =>
            assertUniqueHandleIds(
                [
                    { id: 'in_a', type: 'target' },
                    { id: 'in_a', type: 'target' },
                ] as never,
                'DUP_FIXTURE'
            )
        ).toThrow(/duplicate handle id/i);
    });

    it('empty handle ids fail (dev-only guard)', () => {
        expect(() => assertUniqueHandleIds([{ id: '' }] as never, 'EMPTY_FIXTURE')).toThrow(
            /empty handle id/i
        );
    });
});
