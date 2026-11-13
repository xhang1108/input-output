# B2 基線（改後補錄；改前錄影已不可重現，行為對照見下表）

> 基線 commit `edab14e`。改前六場景僅有文字描述留存（見 REACT_FLOW_AUDIT.md §6.10 分類表），
> 改後以自動化 fixture + 手測步驟補齊。B3 trace fixture 為 machine-readable 基線。

## 自動化對應（已綠）

| 場景 | 自動化證據 |
|---|---|
| GRABBING+Ctrl 20px | `tests/fixtures/hand-trace/grab-ctrl.json` + `useHand.trace.test.ts` |
| GRABBING 無 Ctrl 自由拖曳 | `grab-no-ctrl.json`（回歸 bit-identical） |
| manualSnap 開關 | `grab-manualSnap.json`（改前不吸附→改後吸附，預期改變） |
| axisLock+sanp | `grab-axisLock-X.json`（鎖軸吸附回歸） |
| 數字輸入不吸附 | `grab-transformBuffer.json`（early return 回歸） |
| SCALING 0.05 | `scale-ctrl.json` + `transformSnap.test.ts` |
| ROTATING 15° | `rotate-ctrl.json` + `transformSnap.test.ts` |
| autopan 保持吸附 | `autopan-ctrl.json` |
| Ctrl+右鍵 IDLE 進 CUTTING | `ctrl-rightclick-idle.json` |
| Ctrl+右鍵 transform 中只取消 | `ctrl-rightclick-grabbing.json`（`cutPath` 清空斷言） |
| slot 回歸 | `tests/fixtures/project-before-slot.json` + `projectSlotRegression.test.ts` |
| slot 等價 500 edges | `edgeSlots.test.ts` brute-force oracle |
| relink 回歸 | `useRelink.perf.test.ts` + `CapsuleConnectivity.test.ts` |

## 仍需真人手測（§6.11 A–G 未自動化部分）

- [ ] 手測 autopan 按住 Ctrl 全程吸附，放開不殘留
- [ ] 手測 macOS Ctrl+左鍵進 CUTTING 且不彈選單；Windows Ctrl+右鍵剛進 CUTTING 不被打回 IDLE
- [ ] 手測 ROTATING 170°↔-170° 連續拖不斷裂
- [ ] Profiler 500 edges 拖 node frame 中位數 + long task（改前欄待補真機數）
- [ ] 視覺 `IOPlayground` / `CircuitDemo` 樣式無回歸；署名顯示正常
