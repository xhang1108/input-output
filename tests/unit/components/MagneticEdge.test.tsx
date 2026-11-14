/**
 * @vitest-environment jsdom
 *
 * P1′: MagneticEdge must not render a decorative transparent <BaseEdge>.
 * BaseEdge already emits its own 20px `react-flow__edge-interaction` hit path,
 * so duplicating it produced two hit paths per edge and two copies of the same
 * `d` attribute. `useAutoInsert` queries `path.react-flow__edge-interaction`
 * (falling back to `path.react-flow__edge-path`), so exactly one of each must
 * remain and both must carry the bezier `d`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { getBezierPath, Position, type EdgeProps } from '@xyflow/react';

vi.mock('@xyflow/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xyflow/react')>();
    return {
        ...actual,
        useStore: <T,>(selector: (state: any) => T): T =>
            selector({ edges: [], nodeLookup: new Map(), nodes: [] }),
    };
});

// RelinkLine pulls in the whole relink/handle-magnet stack; only its context is needed.
vi.mock('@/components/edges/RelinkLine', async () => {
    const react = await import('react');
    return {
        RelinkContext: react.createContext({
            active: false,
            targetNodeId: null,
            targetHandleId: null,
            type: 'target' as const,
            anchors: [],
        }),
    };
});

const { MagneticEdge } = await import('@/components/edges/MagneticEdge');
const { RelinkContext } = await import('@/components/edges/RelinkLine');

const geometry = {
    id: 'edge-1',
    source: 'node-a',
    target: 'node-b',
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 100,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    sourceHandleId: 'out',
    targetHandleId: 'in',
};

const expectedPath = getBezierPath({
    sourceX: geometry.sourceX,
    sourceY: geometry.sourceY,
    sourcePosition: geometry.sourcePosition,
    targetX: geometry.targetX,
    targetY: geometry.targetY,
    targetPosition: geometry.targetPosition,
})[0];

function renderEdge(extra: Record<string, unknown> = {}) {
    const props = {
        ...geometry,
        markerEnd: 'url(#marker-1)',
        selected: false,
        data: { pathType: 'bezier' },
        ...extra,
    } as unknown as EdgeProps & { startEdgeDragDisconnect?: () => void };
    return render(<MagneticEdge {...props} />);
}

describe('MagneticEdge rendered paths', () => {
    it('renders exactly one visible path and one interaction path per edge', () => {
        const { container } = renderEdge();
        const paths = container.querySelectorAll('path');

        expect(paths).toHaveLength(2);
        expect(container.querySelectorAll('path.react-flow__edge-path')).toHaveLength(1);
        expect(container.querySelectorAll('path.react-flow__edge-interaction')).toHaveLength(1);
    });

    it('keeps the bezier d on both paths and a 20px hit area', () => {
        const { container } = renderEdge();
        const visible = container.querySelector('path.react-flow__edge-path')!;
        const interaction = container.querySelector('path.react-flow__edge-interaction')!;

        expect(visible.getAttribute('d')).toBe(expectedPath);
        expect(interaction.getAttribute('d')).toBe(expectedPath);
        expect(interaction.getAttribute('stroke-width')).toBe('20');
        expect(visible.getAttribute('marker-end')).toBe('url(#marker-1)');
        expect((visible as SVGPathElement).style.strokeWidth).toBe('2');
    });

    it('auto-insert selector still resolves an interaction path and a path', () => {
        const { container } = renderEdge();
        const pathEl = container.querySelector('path.react-flow__edge-interaction') ??
            container.querySelector('path.react-flow__edge-path');

        expect(pathEl).not.toBeNull();
        expect((pathEl as SVGPathElement).getAttribute('d')).toBe(expectedPath);
        // fallback branch must also work on its own
        expect(container.querySelector('path.react-flow__edge-path')).not.toBeNull();
    });

    it('keeps the drag-to-disconnect circle only when the handler exists', () => {
        const withoutHandler = renderEdge();
        expect(withoutHandler.container.querySelectorAll('circle')).toHaveLength(0);
        withoutHandler.unmount();

        const startEdgeDragDisconnect = vi.fn();
        const withHandler = render(
            <RelinkContext.Provider
                value={{
                    active: false,
                    targetNodeId: null,
                    targetHandleId: null,
                    type: 'target',
                    anchors: [],
                    startEdgeDragDisconnect,
                }}
            >
                <MagneticEdge
                    {...({
                        ...geometry,
                        data: { pathType: 'bezier' },
                    } as unknown as EdgeProps)}
                />
            </RelinkContext.Provider>
        );

        const circles = withHandler.container.querySelectorAll('circle');
        expect(circles).toHaveLength(1);
        expect(circles[0].getAttribute('cx')).toBe(String(geometry.targetX));
        expect(circles[0].getAttribute('cy')).toBe(String(geometry.targetY));
        expect(withHandler.container.querySelectorAll('path')).toHaveLength(2);
    });
});
