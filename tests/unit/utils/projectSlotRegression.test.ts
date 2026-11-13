import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildEdgeSlotIndex } from '../../../src/utils/edgeSlots';

// B4 回歸：含 capsule 多線的專案存檔，方案 C 不寫 data.slot，slot 由 edges 順序即時算出。
describe('project-before-slot golden', () => {
  const p = path.resolve(__dirname, '../../fixtures/project-before-slot.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const edges = raw.graph.edges ?? raw.edges;

  it('存檔無 data.slot（方案C不污染存檔）', () => {
    for (const e of edges) {
      expect(e.data ?? {}).not.toHaveProperty('slot');
      expect(e.data ?? {}).not.toHaveProperty('slotIndex');
    }
  });

  it('載入後 slot 順序正確（依 edges 陣列順序）', () => {
    const idx = buildEdgeSlotIndex(edges);
    expect(idx.get('e1')).toEqual({ index: 0, total: 3 });
    expect(idx.get('e2')).toEqual({ index: 1, total: 3 });
    expect(idx.get('e3')).toEqual({ index: 2, total: 3 });
    expect(idx.get('e4')).toEqual({ index: 0, total: 1 });
  });

  it('刪中間 edge 後即時重編（e2 移除 → e3 遞補 index 1）', () => {
    const rest = edges.filter((e: { id: string }) => e.id !== 'e2');
    const idx = buildEdgeSlotIndex(rest);
    expect(idx.get('e3')).toEqual({ index: 1, total: 2 });
  });
});
