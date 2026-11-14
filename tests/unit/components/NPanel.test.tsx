/**
 * @vitest-environment jsdom
 *
 * P0-4: NPanel shows parent-local coordinates (plus the derived absolute value
 * for nested nodes) and writes positions back through MOVE_NODE as local.
 * Field edits go through useNodeEdit, so history records a BATCH forward patch
 * and the full previous data as the inverse.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Node } from '@xyflow/react';

const mocks = vi.hoisted(() => {
    const history: { past: any[] } = { past: [] };
    const push = vi.fn((entry: any) => {
        history.past.push(entry);
    });
    const replaceLast = vi.fn((expectedId: string, entry: any) => {
        const last = history.past[history.past.length - 1];
        if (!last || last.id !== expectedId) return false;
        history.past[history.past.length - 1] = entry;
        return true;
    });
    return {
        history,
        push,
        replaceLast,
        applyTransaction: vi.fn<(tx: any) => { success: boolean }>(() => ({ success: true })),
        setNodes: vi.fn(),
        updateNodeData: vi.fn<(id: string, patch: Record<string, unknown>) => void>(),
    };
});

let nodes: Node[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: () => nodes,
            setNodes: mocks.setNodes,
            updateNodeData: mocks.updateNodeData,
        }),
        useStore: (selector: (s: { nodes: Node[] }) => unknown) => selector({ nodes }),
    };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({ applyTransaction: mocks.applyTransaction }),
}));

vi.mock('@/store/useHistoryStore', () => {
    const api = {
        push: mocks.push,
        replaceLast: mocks.replaceLast,
        getState: () => ({
            past: mocks.history.past,
            push: mocks.push,
            replaceLast: mocks.replaceLast,
        }),
    };
    const useHistoryStore = ((selector: (state: typeof api) => unknown) => selector(api)) as any;
    useHistoryStore.getState = api.getState;
    return { useHistoryStore };
});

import { NPanel } from '@/components/ui/NPanel';

function makeNode(
    id: string,
    x: number,
    y: number,
    options: { parentId?: string; selected?: boolean; data?: Record<string, unknown> } = {}
): Node {
    return {
        id,
        type: 'test',
        position: { x, y },
        parentId: options.parentId,
        selected: options.selected ?? false,
        data: options.data ?? {},
    } as unknown as Node;
}

function renderPanel(isReadOnly = false) {
    return render(<NPanel isOpen={true} onClose={() => {}} isReadOnly={isReadOnly} />);
}

describe('NPanel position editing', () => {
    beforeEach(() => {
        nodes = [];
        mocks.history.past.length = 0;
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
        mocks.replaceLast.mockClear();
        mocks.setNodes.mockClear();
        mocks.updateNodeData.mockClear();
    });

    it('shows parent-local X/Y and the derived absolute position for a child', () => {
        nodes = [
            makeNode('frame', 1000, 500),
            makeNode('child', 30, 40, { parentId: 'frame', selected: true }),
        ];

        renderPanel();

        expect(screen.getByDisplayValue('30')).toBeTruthy();
        expect(screen.getByDisplayValue('40')).toBeTruthy();
        expect(screen.getByText('Absolute')).toBeTruthy();
        expect(screen.getByText('1030.0, 540.0')).toBeTruthy();
    });

    it('writes MOVE_NODE with the parent-local position, never the absolute one', () => {
        nodes = [
            makeNode('frame', 1000, 500),
            makeNode('child', 30, 40, { parentId: 'frame', selected: true }),
        ];

        renderPanel();
        fireEvent.change(screen.getByDisplayValue('30'), { target: { value: '45' } });

        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        const tx = mocks.applyTransaction.mock.calls[0][0] as { type: string; payload: any };
        expect(tx).toEqual({
            type: 'MOVE_NODE',
            payload: { id: 'child', position: { x: 45, y: 40 } },
        });

        const entry = mocks.push.mock.calls[0][0] as {
            forward: Array<{ type: string; payload: any }>;
            inverse: Array<{ type: string; payload: any }>;
        };
        expect(entry.inverse).toEqual([{
            type: 'MOVE_NODE',
            payload: { id: 'child', position: { x: 30, y: 40 } },
        }]);
        expect(mocks.setNodes).toHaveBeenCalledTimes(1);
    });

    it('keeps root display and writes unchanged when there is no parent', () => {
        nodes = [makeNode('root', 100, 200, { selected: true })];

        renderPanel();

        expect(screen.queryByText('Absolute')).toBeNull();

        fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '150' } });

        const tx = mocks.applyTransaction.mock.calls[0][0] as { type: string; payload: any };
        expect(tx).toEqual({
            type: 'MOVE_NODE',
            payload: { id: 'root', position: { x: 150, y: 200 } },
        });
    });

    it('collapses a burst of position edits into one history entry', () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
            nodes = [makeNode('root', 100, 200, { selected: true })];
            renderPanel();

            const input = screen.getByDisplayValue('100');
            fireEvent.change(input, { target: { value: '110' } });
            vi.setSystemTime(new Date('2026-11-14T00:00:00.200Z'));
            fireEvent.change(input, { target: { value: '120' } });

            expect(mocks.push).toHaveBeenCalledTimes(1);
            expect(mocks.replaceLast).toHaveBeenCalledTimes(1);

            const entryId = mocks.replaceLast.mock.calls[0][0];
            const replacement = mocks.replaceLast.mock.calls[0][1] as {
                id: string;
                forward: Array<{ payload: any }>;
                inverse: Array<{ payload: any }>;
            };
            expect(replacement.id).toBe(entryId);
            // Undo goes back to the value before typing started.
            expect(replacement.inverse).toEqual([{
                type: 'MOVE_NODE',
                payload: { id: 'root', position: { x: 100, y: 200 } },
            }]);
            expect(replacement.forward[0].payload).toEqual({
                id: 'root',
                position: { x: 120, y: 200 },
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('starts a new history entry when the edit gap exceeds the merge window', () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
            nodes = [makeNode('root', 100, 200, { selected: true })];
            renderPanel();

            const input = screen.getByDisplayValue('100');
            fireEvent.change(input, { target: { value: '110' } });
            vi.setSystemTime(new Date('2026-11-14T00:00:02Z'));
            fireEvent.change(input, { target: { value: '120' } });

            expect(mocks.replaceLast).not.toHaveBeenCalled();
            expect(mocks.push).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('NPanel field history', () => {
    beforeEach(() => {
        nodes = [];
        mocks.history.past.length = 0;
        mocks.applyTransaction.mockClear();
        mocks.push.mockClear();
        mocks.replaceLast.mockClear();
        mocks.setNodes.mockClear();
        mocks.updateNodeData.mockClear();
    });

    it('records one BATCH entry whose inverse carries the full previous data', () => {
        nodes = [makeNode('field-node', 0, 0, {
            selected: true,
            data: { label: 'Old', keep: 1 },
        })];

        renderPanel();
        fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New' } });

        expect(mocks.applyTransaction).toHaveBeenCalledTimes(1);
        expect(mocks.applyTransaction.mock.calls[0][0]).toEqual({
            type: 'BATCH',
            payload: [
                { type: 'UPDATE_NODE_DATA', payload: { id: 'field-node', data: { label: 'New' } } },
            ],
        });

        expect(mocks.history.past).toHaveLength(1);
        const entry = mocks.history.past[0];
        expect(entry.forward).toEqual([
            { type: 'UPDATE_NODE_DATA', payload: { id: 'field-node', data: { label: 'New' } } },
        ]);
        // Full previous data, not just the patched key.
        expect(entry.inverse).toEqual([
            { type: 'UPDATE_NODE_DATA', payload: { id: 'field-node', data: { label: 'Old', keep: 1 } } },
        ]);
        // UI stays responsive for metadata edits.
        expect(mocks.updateNodeData).toHaveBeenCalledWith('field-node', { label: 'New' });
    });

    it('merges repeated edits of one field into a single entry within 800ms', () => {
        vi.useFakeTimers();
        try {
            vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
            nodes = [makeNode('merge-node', 0, 0, {
                selected: true,
                data: { label: 'Old', keep: 2 },
            })];

            renderPanel();
            const input = screen.getByDisplayValue('Old');
            fireEvent.change(input, { target: { value: 'New' } });

            // The Brain projection lands before the next keystroke.
            nodes = [makeNode('merge-node', 0, 0, {
                selected: true,
                data: { label: 'New', keep: 2 },
            })];
            vi.setSystemTime(new Date('2026-11-14T00:00:00.200Z'));
            fireEvent.change(input, { target: { value: 'Newer' } });

            expect(mocks.push).toHaveBeenCalledTimes(1);
            expect(mocks.replaceLast).toHaveBeenCalledTimes(1);
            expect(mocks.history.past).toHaveLength(1);

            const merged = mocks.history.past[0];
            expect(merged.forward[0].payload.data).toEqual({ label: 'Newer' });
            // Undo returns to the value before typing started, not 'New'.
            expect(merged.inverse[0].payload.data).toEqual({ label: 'Old', keep: 2 });
        } finally {
            vi.useRealTimers();
        }
    });

    it('refuses edits in read-only mode', () => {
        nodes = [makeNode('ro-node', 0, 0, {
            selected: true,
            data: { label: 'Old' },
        })];

        renderPanel(true);
        fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New' } });

        expect(mocks.applyTransaction).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
        expect(mocks.updateNodeData).not.toHaveBeenCalled();
    });
});
