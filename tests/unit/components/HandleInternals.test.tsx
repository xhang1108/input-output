/**
 * P2-9: `updateNodeInternals` density probe.
 *
 * @vitest-environment jsdom
 *
 * Mount cost must be `1 + #capsule` per node:
 * - BaseNode node-level effect: 1 (retained)
 * - CapsuleHandle height effect: 1 per capsule (retained)
 * - SingleHandle mount effect: 0 (removed; fixed 12px layout needs no update)
 * - NodeHandle mount effect: 0 (removed; React Flow clears bounds on unmount)
 *
 * Red state (before fix): SingleHandle calls updateNodeInternals once on mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

const updateNodeInternalsMock = vi.fn();

vi.mock('@xyflow/react', () => ({
    Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
    Handle: (props: Record<string, unknown>) => React.createElement('div', { 'data-handleid': props.id }),
    useUpdateNodeInternals: () => updateNodeInternalsMock,
    useNodeConnections: () => [],
}));

import { render } from '@testing-library/react';
import { SingleHandle } from '@/components/nodes/SingleHandle';
import { CapsuleHandle } from '@/components/nodes/CapsuleHandle';

const singleConfig = { id: 'in_a', type: 'target', dataType: 'scalar' } as never;
const capsuleConfig = { id: 'in_a', type: 'target', variant: 'capsule', dataType: 'scalar' } as never;

describe('HandleInternals updateNodeInternals density', () => {
    beforeEach(() => {
        updateNodeInternalsMock.mockClear();
    });

    it('SingleHandle does not call updateNodeInternals on mount', () => {
        render(React.createElement(SingleHandle, { h: singleConfig, id: 'n1', isConnectable: true }));
        expect(updateNodeInternalsMock).not.toHaveBeenCalled();
    });

    it('CapsuleHandle calls updateNodeInternals exactly once on mount', () => {
        render(React.createElement(CapsuleHandle, { h: capsuleConfig, id: 'n1', isConnectable: true }));
        expect(updateNodeInternalsMock).toHaveBeenCalledTimes(1);
        expect(updateNodeInternalsMock).toHaveBeenCalledWith('n1');
    });
});
