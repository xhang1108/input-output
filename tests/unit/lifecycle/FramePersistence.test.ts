import { beforeEach, describe, expect, it } from 'vitest';
import { Brain } from '@/engine/Brain';
import { Serializer } from '@/engine/Serializer';
import type { ProjectData } from '@/engine/types';

/**
 * Frame persistence: a frame is only useful if its size and its children's
 * parent-local positions survive save -> load. Serializer keeps `parentId`,
 * `width` and `height`, and `Brain.injectNodes` forwards them to ADD_NODE.
 */
describe('Frame persistence', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getComputeSession('test-frame-persistence');
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('keeps parentId, frame size and child local positions through injectNodes', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'f1', type: 'frame', position: { x: 100, y: 200 }, width: 400, height: 300, data: { label: 'Group 1', width: 400, height: 300 } },
                { id: 'n1', type: 'IN-01', position: { x: 20, y: 30 }, parentId: 'f1', data: { value: 42 } },
                { id: 'n2', type: 'OT-01', position: { x: 20, y: 120 }, parentId: 'f1' },
            ],
            edges: [
                { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in_a' },
            ],
        });

        const frame = brain.getNode('f1');
        expect(frame?.width).toBe(400);
        expect(frame?.height).toBe(300);
        expect(frame?.position).toEqual({ x: 100, y: 200 });

        const child = brain.getNode('n1');
        expect(child?.parentId).toBe('f1');
        expect(child?.position).toEqual({ x: 20, y: 30 });
    });

    it('round-trips a frame project through serialize -> deserialize', () => {
        const project = {
            nodes: [
                { id: 'f1', type: 'frame', position: { x: 100, y: 200 }, width: 400, height: 300, data: { label: 'Group 1' } },
                { id: 'n1', type: 'IN-01', position: { x: 20, y: 30 }, parentId: 'f1', data: { value: 42 } },
            ],
            edges: [],
            version: '1.1.0',
        } as unknown as ProjectData;

        const restored = Serializer.deserialize(Serializer.serialize(project));
        expect(restored).not.toBeNull();

        const frame = restored!.nodes.find(n => n.id === 'f1')!;
        expect(frame.parentId).toBeUndefined();
        expect(frame.width).toBe(400);
        expect(frame.height).toBe(300);
        expect(frame.position).toEqual({ x: 100, y: 200 });

        const child = restored!.nodes.find(n => n.id === 'n1')!;
        expect(child.parentId).toBe('f1');
        expect(child.position).toEqual({ x: 20, y: 30 });
    });

    it('saves a frame project and reloads it into a fresh Brain', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'f1', type: 'frame', position: { x: 10, y: 20 }, width: 360, height: 240, data: { label: 'Group 1' } },
                { id: 'n1', type: 'IN-01', position: { x: 12, y: 34 }, parentId: 'f1', data: { value: 1 } },
            ],
            edges: [],
        });

        const saved = Serializer.serialize({
            nodes: Array.from(brain.getNodesMap().values()).map(n => ({
                id: n.id,
                type: n.type,
                position: n.position,
                data: n.data,
                parentId: n.parentId,
                width: n.width,
                height: n.height,
            })),
            edges: [],
            version: '1.1.0',
        } as unknown as ProjectData);

        const reloaded = Serializer.deserialize(saved)!;
        const session = Brain.getComputeSession('test-frame-persistence-reload');
        await session.injectNodes({ nodes: reloaded.nodes, edges: reloaded.edges }, true);

        const frame = session.getNode('f1');
        expect(frame?.width).toBe(360);
        expect(frame?.height).toBe(240);
        expect(session.getNode('n1')?.parentId).toBe('f1');
        expect(session.getNode('n1')?.position).toEqual({ x: 12, y: 34 });
    });
});
