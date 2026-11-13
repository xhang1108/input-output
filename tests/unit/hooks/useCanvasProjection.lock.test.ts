import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(`${process.cwd()}/${p}`, 'utf8');

// B3 缺口補充（§6.13#1）：B3 harness 的 mock project() 是 identity，
// 不覆蓋原生 snapToGrid 量化。此測試鎖定 useCanvasProjection 兩處呼叫
// 永遠帶 { snapToGrid: false }，確保未來有人打開 store 開關也不會量化。
describe('B3 supplement: projection never quantizes', () => {
  it('project() 與 getEventFlowPos() 都帶 { snapToGrid: false }', () => {
    const src = read('src/hooks/useCanvasProjection.ts');
    const hits = src.match(/screenToFlowPosition\([^;]*snapToGrid:\s*false[^;]*\)/g) ?? [];
    expect(hits.length).toBe(2);
  });

  it('無裸呼叫 screenToFlowPosition（不帶 options）', () => {
    const src = read('src/hooks/useCanvasProjection.ts');
    const bare = src.match(/screenToFlowPosition\(\s*screenPos\s*\)/g) ?? [];
    const bareEvent = src.match(/screenToFlowPosition\(\s*\{\s*x:\s*e\.clientX[^}]*\}\s*\)/g) ?? [];
    expect([...bare, ...bareEvent]).toEqual([]);
  });
});
