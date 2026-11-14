/**
 * @vitest-environment jsdom
 *
 * NPanel is always mounted, so its closed path must not touch the React Flow
 * store at all: a closed panel that subscribes would re-render (and run O(n)
 * selectors) on every drag frame.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Node } from '@xyflow/react';

const mocks = vi.hoisted(() => ({ selectorCalls: 0 }));

let nodes: Node[] = [];

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useReactFlow: () => ({
            getNodes: () => nodes,
            setNodes: vi.fn(),
            updateNodeData: vi.fn(),
        }),
        useStore: (selector: (s: { nodes: Node[] }) => unknown) => {
            mocks.selectorCalls += 1;
            return selector({ nodes });
        },
    };
});

vi.mock('@/context/BrainContext', () => ({
    useBrain: () => ({ applyTransaction: () => ({ success: true }) }),
}));

vi.mock('@/store/useHistoryStore', () => {
    const api = {
        push: () => {},
        replaceLast: () => false,
        getState: () => ({ past: [], push: () => {}, replaceLast: () => false }),
    };
    const useHistoryStore = ((selector: (state: typeof api) => unknown) => selector(api)) as any;
    useHistoryStore.getState = api.getState;
    return { useHistoryStore };
});

import { NPanel } from '@/components/ui/NPanel';

function makeNode(id: string, x: number, y: number, selected = false): Node {
    return {
        id,
        type: 'test',
        position: { x, y },
        selected,
        data: {},
    } as unknown as Node;
}

describe('NPanel closed path', () => {
    beforeEach(() => {
        nodes = [];
        mocks.selectorCalls = 0;
    });

    it('renders nothing and reads no store state while closed', () => {
        nodes = [makeNode('n1', 10, 20, true)];

        const { container } = render(<NPanel isOpen={false} onClose={() => {}} />);

        expect(container.innerHTML).toBe('');
        expect(mocks.selectorCalls).toBe(0);
    });

    it('mounts the panel content when open', () => {
        render(<NPanel isOpen={true} onClose={() => {}} />);

        expect(screen.getByText('CLOSE')).toBeTruthy();
        expect(screen.getByText('N PANEL')).toBeTruthy();
        expect(mocks.selectorCalls).toBeGreaterThan(0);
    });

    it('never calls onClose while closed', () => {
        const onClose = vi.fn();
        render(<NPanel isOpen={false} onClose={onClose} />);

        expect(onClose).not.toHaveBeenCalled();
    });
});
