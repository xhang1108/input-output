'use client';

import { useCallback } from 'react';
import { Node, useReactFlow } from '@xyflow/react';
import { useBrain } from '../context/BrainContext';
import { useHistoryStore } from '../store/useHistoryStore';
import { Transaction } from '../engine/types/engineTypes';
import { generateNodeId } from '../utils/idGenerator';
import { getEffectiveRoots, indexNodes, toAbsolute } from '../utils/coordinates';

const FRAME_PADDING = 32;
const FRAME_TOP_PADDING = 40;

function getSize(node: Node): { w: number; h: number } {
    return {
        w: node.width ?? node.measured?.width ?? (node.data?.width as number) ?? 150,
        h: node.height ?? node.measured?.height ?? (node.data?.height as number) ?? 50,
    };
}

/**
 * F key: group the current selection into a frame, or ungroup direct children
 * of the same frame. Single-level only: a frame cannot become a child.
 */
export function useFrameActions() {
    const { getNodes } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);

    const groupSelection = useCallback((nodes: Node[], selected: Node[]) => {
        const selectedIds = new Set(selected.map(n => n.id));
        const roots = getEffectiveRoots(nodes, selectedIds)
            .filter(n => n.type !== 'frame' && !n.parentId);

        if (roots.length === 0) return false;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const node of roots) {
            const abs = toAbsolute(indexNodes(nodes), node.id);
            const { w, h } = getSize(node);
            minX = Math.min(minX, abs.x);
            minY = Math.min(minY, abs.y);
            maxX = Math.max(maxX, abs.x + w);
            maxY = Math.max(maxY, abs.y + h);
        }

        const framePos = {
            x: Math.round(minX - FRAME_PADDING),
            y: Math.round(minY - FRAME_TOP_PADDING),
        };
        const width = Math.max(200, Math.round(maxX - minX + FRAME_PADDING * 2));
        const height = Math.max(120, Math.round(maxY - minY + FRAME_TOP_PADDING + FRAME_PADDING));
        const frameId = generateNodeId('frame');

        const forward: Transaction[] = [
            {
                type: 'ADD_NODE',
                payload: {
                    id: frameId,
                    type: 'frame',
                    position: framePos,
                    width,
                    height,
                    data: { label: 'Frame', width, height },
                },
            },
            ...roots.map(node => {
                const abs = toAbsolute(indexNodes(nodes), node.id);
                return {
                    type: 'MOVE_NODE' as const,
                    payload: {
                        id: node.id,
                        position: {
                            x: abs.x - framePos.x,
                            y: abs.y - framePos.y,
                        },
                        parentId: frameId,
                    },
                };
            }),
        ];

        const inverse: Transaction[] = [
            ...roots.map(node => ({
                type: 'MOVE_NODE' as const,
                payload: {
                    id: node.id,
                    position: { ...node.position },
                    parentId: null,
                },
            })),
            { type: 'REMOVE_NODE', payload: frameId },
        ];

        const result = brain.applyTransaction({ type: 'BATCH', payload: forward });
        if (!result.success) return false;

        pushHistory({
            id: `group_${Date.now()}`,
            description: `Group ${roots.length} node(s)`,
            forward,
            inverse,
        });
        return true;
    }, [brain, pushHistory]);

    const ungroupSelection = useCallback((nodes: Node[], selected: Node[]) => {
        const children = selected.filter(n => n.type !== 'frame' && n.parentId);
        if (children.length === 0) return false;

        const frameIds = Array.from(new Set(children.map(n => n.parentId!)));
        const nodeById = indexNodes(nodes);
        const frames = frameIds
            .map(id => nodes.find(n => n.id === id))
            .filter((n): n is Node => !!n);
        if (frames.length === 0) return false;

        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        for (const child of children) {
            const abs = toAbsolute(nodeById, child.id);
            forward.push({
                type: 'MOVE_NODE',
                payload: {
                    id: child.id,
                    position: abs,
                    parentId: null,
                },
            });
            inverse.push({
                type: 'MOVE_NODE',
                payload: {
                    id: child.id,
                    position: { ...child.position },
                    parentId: child.parentId!,
                },
            });
        }

        // Drop frames that no longer have children (single-level).
        for (const frame of frames) {
            const remaining = nodes.some(n =>
                n.parentId === frame.id && !children.some(c => c.id === n.id)
            );
            if (remaining) continue;

            forward.push({ type: 'REMOVE_NODE', payload: frame.id });
            inverse.unshift({
                type: 'ADD_NODE',
                payload: {
                    id: frame.id,
                    type: frame.type || 'frame',
                    position: { ...frame.position },
                    width: frame.width ?? (frame.data?.width as number),
                    height: frame.height ?? (frame.data?.height as number),
                    data: { ...frame.data },
                },
            });
        }

        const result = brain.applyTransaction({ type: 'BATCH', payload: forward });
        if (!result.success) return false;

        pushHistory({
            id: `ungroup_${Date.now()}`,
            description: `Ungroup ${children.length} node(s)`,
            forward,
            inverse,
        });
        return true;
    }, [brain, pushHistory]);

    const frameSelected = useCallback(() => {
        const nodes = getNodes();
        const selected = nodes.filter(n => n.selected && n.type !== 'frame');
        if (selected.length === 0) return false;

        const parentIds = new Set(selected.map(n => n.parentId).filter(Boolean));
        const allParented = selected.every(n => !!n.parentId);
        const mixed = selected.some(n => !!n.parentId) && !allParented;

        if (mixed) return false;
        if (allParented && parentIds.size === 1) {
            return ungroupSelection(nodes, selected);
        }
        return groupSelection(nodes, selected);
    }, [getNodes, groupSelection, ungroupSelection]);

    const detachNode = useCallback((id: string) => {
        const nodes = getNodes();
        const node = nodes.find(n => n.id === id);
        if (!node?.parentId) return false;

        const absolute = toAbsolute(indexNodes(nodes), id);
        const forward: Transaction[] = [{
            type: 'MOVE_NODE',
            payload: { id, position: absolute, parentId: null },
        }];
        const inverse: Transaction[] = [{
            type: 'MOVE_NODE',
            payload: { id, position: { ...node.position }, parentId: node.parentId },
        }];

        const result = brain.applyTransaction({ type: 'BATCH', payload: forward });
        if (!result.success) return false;

        pushHistory({
            id: `detach_${Date.now()}`,
            description: 'Detach from frame',
            forward,
            inverse,
        });
        return true;
    }, [getNodes, brain, pushHistory]);

    return { frameSelected, detachNode };
}
