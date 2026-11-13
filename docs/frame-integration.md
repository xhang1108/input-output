# Frame（Group / Subflow）接入評估

- **日期**：2026-11-13
- **來源**：`guide/frame`（React Flow 官方 dynamic parent-child 範例，`@xyflow/react ^12.12.0`、React 19.2.5）
- **目標**：`input-output`（`@xyflow/react 12.10.2`、React 19.2.4）
- **性質**：設計評估，不含實作。行號以此 worktree 當下內容為準。

---

## 0. 結論（先看這段）

1. **官方的資料模型可用**：`parentId` + 子節點相對座標 + parent 先 render。我們的 UI 已經是 `nodeOrigin=[0,0]`（`FlowCanvas.tsx:62,738`），語意一致。
2. **官方的拖曳實作不能照抄**：我們 `nodesDraggable={false}`（`FlowCanvas.tsx:721`），拖曳由 `useHand` 自製（snap、axis lock、autopan、SCALE/ROTATE）。`onNodeDrag` / `onNodeDragStop` 永遠不會 fire。能移植的是「drop 時找 frame + 轉相對座標」的計算。
3. **接入前先做座標治根（P0）**：根因不是單一 offset，而是幾何有三個權威（RF internals / Brain 自算 / hooks 手算），且測試把 center 制鎖住。治根方案見 §4 P0：一個 `coordinates.ts`、五個可獨立 review 的 PR。
4. **第一版建議**：單層 frame、不可巢狀、手動尺寸、不做自動貼合、不用 `extent`。子節點拖到邊界就 clamp；detach 只透過 toolbar / F。這組取捨可直接避開上次的 jitter、雙重移動、sticky 100px 問題。
5. **存檔 schema 不變，但目前「存得下、載不回」**：`parentId` / `width` / `height` 有寫入（`Serializer.ts:39-59`、`useProjectSave.ts:149-157`），但 `Brain.injectNodes` 沒把 `width/height` 放進 `ADD_NODE`（`Brain.ts:1193-1203`）。`AddNodePayload` 與 reducer 其實已支援，修法約 4 行。不需要新 dependency（Vercel/CSP 不變）。
6. **實作順序**：P0（座標治根，5 PR）→ P0.5（nullable parentId / deleteKeyCode / width-height 載入）→ P1（frame 核心）→ P2（下游整合）。P0 不改 schema、不碰 frame UI，可以先單獨合併。粗估 P0 1.5–2 天、P0.5 0.5 天、P1 2–3 天、P2 2–3 天。
7. **已拍板**：clamp、刪 frame 轉 independent、手動 resize + on-demand auto-fit、單層；IOGL 建議支援，方案見 §4 P2.1。

---

## 1. 官方範例在做什麼

| 檔案 | 行為 | 能否直接移植 |
|---|---|---|
| `src/App.tsx` | `useNodesState` + `nodeTypes={{node: SimpleNode}}` + `onNodeDrag` / `onNodeDragStop` + `selectNodesOnDrag={false}` | 不能。我們是 uncontrolled + Brain。 |
| `src/useNodeDragHandlers.ts` | `onNodeDrag` 用 `getIntersectingNodes` 標記 hover 的 group；`onNodeDragStop` 掛 parent、算相對座標、加 `extent:'parent'`、parent 排前 | 邏輯可移植；事件來源要換成 `confirmGrab`。 |
| `src/useDetachNodes.ts` | `getInternalNode(parentId).internals.positionAbsolute + position`，清 `parentId` / `extent` / `expandParent` | 數學可移植；寫入要改成 Brain transaction。 |
| `src/SimpleNode.tsx` | `NodeToolbar`（Delete / Detach）、`useStore(nodeLookup.get(id).parentId)`、`deleteElements` | Toolbar 可用；`deleteElements` **不可用**（繞過 Brain，見 §3-D6）。 |
| `src/utils.ts` | `sortNodes`（group 優先）、`getNodePositionInsideParent`（clamp 進 parent） | clamp 數學可用；排序要改成 depth-aware。 |
| `src/initial-elements.ts` | group + child + 游離節點 | 可直接當測試 fixture。 |

### 1.1 掛載計算（`useNodeDragHandlers.ts:27-45`）

```ts
const position = getNodePositionInsideParent(n, groupNode) ?? { x: 0, y: 0 };
return { ...n, position, parentId: groupNode.id, extent: 'parent' } as Node;
```

`getNodePositionInsideParent`（`utils.ts:13-40`）在 top-left 語意下就是：

```text
childRelative = clamp(childAbsolute - groupAbsolute, 0, groupSize - childSize)
```

注意：官方 helper 用的是 `groupNode.position`。當 group 自己是 nested child 時，`position` 是 relative，這個公式只對 **root frame** 成立。我們第一版單層，等價；若未來做巢狀，必須改用 `internals.positionAbsolute`。

### 1.2 解除計算（`useDetachNodes.ts:13-27`）

```ts
position: {
  x: n.position.x + parentNode.internals.positionAbsolute.x,
  y: n.position.y + parentNode.internals.positionAbsolute.y,
}
```

以我們 `origin=[0,0]` 來說這是正確公式。可直接抽成共用 helper。

### 1.3 授權

`guide/frame` 是 xyflow Pro content（`LICENSE.md`）。條款允許 modify / integrate 進應用（含商業），但**不得把 pro content 當 standalone example 再散布**，也不得移除 attribution。建議只重寫那兩個小數學 helper（合計 < 50 行），不要整檔複製；若真的要複製，保留出處註解。

---

## 2. 現況：我們其實已有「半套 frame」

### 2.1 已存在

| 能力 | 位置 |
|---|---|
| `NodeLogic.parentId` | `src/engine/types/engineTypes.ts:18` |
| `MOVE_NODE` 可帶 `parentId`（含 undo 同步） | `engineTypes.ts:65-69`、`TransactionManager.ts:140-144`、`useHistoryExecutor.ts:46-55` |
| 序列化 `parentId` / `width` / `height` | `Serializer.ts:39-59`、`useProjectSave.ts:149-157` |
| frame zIndex −100、child +100 | `useBrainUpdates.ts:142-143` |
| parent 先 render | `useBrainUpdates.ts:239-244`（只分一層） |
| 刪除 inverse 保留 parentId / 尺寸 | `useSelection.ts:30-40` |
| `initialParentIds`、nesting guard、frames stub | `useHand.ts:50,335,474-483,543` |
| clipboard 已是 parent-aware（DEC-6 B） | `clipboardMath.ts:8-24,120-160` |
| engine 的 `frame` no-op evaluator | `engine/nodes/utilityNodes.ts:27-30` |
| frame CSS（`.frame-resize-*` 是 dead CSS） | `app/globals.css:338-407` |
| `F` 快捷鍵條目、StatusBar 文案（兩者 label 不一致） | `constants/shortcuts.ts:76-82`、`ui/StatusBar.tsx:61` |
| 測試白名單已含 `frame`（今日 inert，frame 進 `nodeTypes` 後才有意義） | `tests/unit/engine/RegistryStability.test.ts:24` |

### 2.2 缺少 / 壞掉

| 缺口 | 影響 |
|---|---|
| `FrameNode` 不存在、`nodeTypes` 無 `frame` | 舊 frame 專案落到 default node，看起來像孤兒。 |
| `.react-flow__node-frame { pointer-events:none !important }`（`globals.css:342-344`） | frame 不能點、不能拖、不能 resize。 |
| `F` 沒有 handler（`FlowCanvas.tsx:407-584` 無 `nodes:bundle`） | 死鍵，但 UI 還在廣告 `F: Group`。 |
| `REMOVE_NODE` 不處理 children（`TransactionManager.ts:100-110`） | frame unwrap 必須在 `useSelection` 顯式完成，否則留下孤兒 child。 |
| `Brain.getAbsolutePosition` 用 center-origin | `boundingBox` metadata 對 nested child 偏移（`getNodeBoundingBox` 目前無消費者）。 |
| `useHand.getAbsolutePosition` 直接回傳 relative position（`useHand.ts:78-82`） | scale/rotate 的 pivot 與輸出全錯。 |
| `applyScale` / `applyRotate` 把 absolute 結果寫回 relative `position`（`useHand.ts:145-148,177-180`） | frame child 一旦被選取縮放/旋轉就永久位移 `parentAbsolute`。這是本次接入最嚴重的一項。 |
| `injectNodes` 不轉交 `width/height`（`Brain.ts:1193-1203`） | frame 尺寸只能靠 `data.width` fallback 復原（`AddNodePayload` / reducer 已支援，只差 4 行）。 |
| 自動 layout 是扁平（`layoutEngine.ts:56-81`） | frame 會被當普通節點，children 被拉成絕對座標。 |
| `RE-LAYOUT` 重建 Node 時不帶 `parentId`（`useAutoLayout.ts:189-210`） | 一次自動 layout 就把群組洗掉，並整批覆蓋 UI 欄位。 |
| 選 frame 不連帶選 children（`useClipboard.ts:36,75`） | copy/duplicate frame 得到空框。 |
| knife / auto-insert / align 把 relative 當 absolute；NPanel 只 `setNodes` 不發 transaction | 在 frame 內操作會錯位，或被 Brain sync 蓋回。 |
| IOGL 格式沒有 parent 語法（`Encoder.ts:97-103`、`Parser.ts:476`） | child 的 local 座標被寫成 `@x,y`、匯入又當 absolute → round-trip 位移；frame 也會遺失。 |
| `onNodesChangeSafe` 忽略 `remove`（`FlowCanvas.tsx:183-223`） | 任何走 RF 原生刪除的路徑都會 UI/Brain 不同步。 |

### 2.3 座標衝突是最大地雷

| 位置 | 語意 |
|---|---|
| `FlowCanvas.tsx:62,738` | top-left（真相） |
| `useClipboard.test.ts:50-58` + `clipboardMath.ts:8-24` | top-left |
| `Brain.ts:1035-1043` | centered：`parentAbs - parentW/2` |
| `CoordinateNormalization.test.ts:45-89` | 仍斷言 centered |

結論：**接入 frame 的第一步不是畫框，是把座標語意統一成 top-left。** 這是獨立 bug fix，可以先單獨合併。

補充影響面（避免誇大）：`Brain.getAbsolutePosition` 目前只被 `updateNodeBoundingBox`（`Brain.ts:1067`）與 `computeBoundingBox`（`:1096`）呼叫；`getNodeBoundingBox` 在 `src/` 沒有消費者，所以現階段是 metadata 污染，不是現行 A* 已經壞掉。真正會把 frame child 位置寫壞的是 `useHand` 的 scale/rotate。

### 2.4 根因：不是三個 bug，是「幾何沒有單一權威」

| # | 根因 | 現象 |
|---|---|---|
| R1 | 同一份幾何有三個來源：RF `internals.positionAbsolute`、`Brain` 自算、hooks 手算 | 同一節點在不同功能得到不同 absolute |
| R2 | 沒有書面座標契約；`CoordinateNormalization` 反而把 center 制鎖住 | 修一處，另一處又退回去 |
| R3 | 沒有 hierarchy invariant（parent 存在 / 無 cycle / parent 先於 child） | 壞資料可以進 Brain，frame 上線後才爆 |
| R4 | local 與 world 沒有型別/命名區分，`position` 被當成兩種東西 | 每個新功能都要重新猜一次 |

所以治根不是再修一個 offset，而是：**absolute 只能由一個函式產生，其他路徑只能呼叫它或 RF internals。**

---

## 3. 接入設計（決策）

### D1 — 座標：top-left 為唯一真相

- 修 `Brain.getAbsolutePosition`：移除 `- parentW/2`、`- parentH/2`，加 cycle guard。
- 修 `useHand.getAbsolutePosition`：用 RF `getInternalNode(id).internals.positionAbsolute`，或沿用 clipboard 的遞迴 helper。
- 抽共用：`src/utils/coordinates.ts`（從 `clipboardMath.getNodeAbsolutePosition` 抽出），讓 clip / hand / knife / auto-insert / align 共用。
- 更新 `CoordinateNormalization.test.ts` 與 `clipboardMath.ts:8-24` 的歷史註解。
- **代價**：舊 center-era 專案的 frame 資料會偏 `parentSize/2`；`boundingBox` metadata 會改變（目前尚無消費者，但這是修正，不是退化）。

#### D1.1 座標治理規則（single source of truth）

「統一一個座標」不是把所有節點都存在 world 座標；那會逼 parent 移動時逐一改 child，正是上次 jitter 的來源。要統一的是**規則與換算實作**：

1. **規則以 React Flow top-left 為準**。`position` 永遠是 top-left；有 `parentId` 就是 parent-local，root 才是 world。UI 的可信 absolute 是 RF `internals.positionAbsolute`。
2. **world 座標只推導、不儲存**。存檔只寫 `position` + `parentId`，不寫 absolute。
3. **只有一份換算實作**：`src/utils/coordinates.ts` 的 `toAbsolute()` / `toParentLocal()` / `reparentPosition()`。禁止在其他檔案手寫 `parent.position + node.position`。
4. **Engine 不自己發明公式**：`Brain.getAbsolutePosition` 改呼叫同一支純函式（輸入 `Map<id, {position, parentId}>`），或整支刪掉、bbox 改吃 UI 回報的 absolute。**二選一，不要兩套並存**；目前建議留純函式，因為 bbox 需要在 UI resize 之外也能重算。
5. **UI 也不手算**：`useHand` / knife / auto-insert / align 用 RF `internals.positionAbsolute` 或同一支純函式；不得直接拿 `n.position` 當 world。
6. **不變量**：每個 `parentId` 必須存在、無 cycle、parent 在陣列中先於 child；載入與 attach 後都驗一次。
7. **測試只測共用函式**，不要讓 `CoordinateNormalization` 與 clipboard 各自維護一套公式。

代價：短期要改一輪呼叫點；換來的是「任何新功能只需要問 coordinates.ts」，以及 frame/巢狀可以安全擴充。

### D2 — 拖曳：保留 `useHand`，把 attach 移植進 `confirmGrab`

- 不開 `nodesDraggable`。官方 `onNodeDrag*` 不適用。
- 在 `startGrab` 先算 **effective roots**：如果某 node 的祖先也在選取集合，就從移動清單剔除。React Flow 會用 parent transform 自動帶動 child，不需要我們再移動一次。
- `applyMove` / `applyScale` / `applyRotate` 只作用 roots；child 的 relative position 不變。
- `confirmGrab` 結算時：
  1. 用 drop 當下的 absolute rect（自己算，不依賴 Brain）找 `type === 'frame'` 的交集。
  2. 排除自己、自己的祖先/子孫；多個候選取 **面積最小**（官方取 `intersections[0]`，順序不保證）。
  3. `relative = absolute - frameAbsolute`，clamp 進框。
  4. 發 `BATCH MOVE_NODE { position, parentId }`；inverse 已有 `initialParentIds` 可還原 **attach**。
  5. **前置資料模型修正（阻塞 detach）**：`MoveNodePayload.parentId` 目前是 `string | undefined`（`engineTypes.ts:68`），`TransactionManager` 只在 `p.parentId !== undefined` 時寫入（`:142-143`），所以「清空 parentId」送不進去。必須改成 `string | null`，兩處 reducer（`TransactionManager.ts:142-143`、`useHistoryExecutor.ts:51`）改用 `'parentId' in p` 判斷。
- 注意：`TransactionManager` 的 `BATCH` 是逐筆套用、失敗不 rollback（`:202-211`）；attach/delete 的 batch 要嘛先驗證、要嘛接受部分套用。
- 注意：`confirmGrab` 的 forward 只包含 `movedNodeIds`，inverse 卻從整個 `initialPositions` 產生（`useHand.ts:482` vs `:491-503`）。展開 descendants 後會產生多餘 inverse，實作時要對齊。
- UI 陣列要按 depth 重排（§D4），確保 parent 先於 child。
- **代價**：`getIntersectingNodes` 對「拖曳中尚未 re-render 的 internals」可能滯後；用自己算的 rect 較穩。

### D3 — 邊界：不用 `extent`，改自訂 clamp

- 歷史上 `extent:'parent'` 造成 crash（`35f1045` 的註解：parent 未量測時 `clampPositionToParent`）。在 12.10.2，`calculateNodePosition` 對 string extent 只會在 parent 已量測時才組成 coordinate extent；未量測就保持字串，`isCoordinateExtent()` 為 false，因此既不 clamp 也不 crash（`node_modules/@xyflow/system/dist/esm/index.js:451-465`）。
- 但我們 `nodesDraggable=false`，`extent` 從頭到尾不會被採用。加了只會誤導後人，也會在未來開啟 RF drag 時改變行為。
- 做法：在 `applyMove` 對有 `parentId` 的節點做相對座標 clamp（`0 .. frameSize - childSize`，尺寸未知時用 `measured` / `width` / `data.width`）。
- **代價**：沒有 RF 原生 `expandParent`；containment 是我們的責任。存檔不需要 `extent`。

### D4 — Frame 節點：自訂 `type: 'frame'`，單層

- 新檔 `src/components/nodes/FrameNode.tsx`：
  - 無 Handle；`width/height: 100%`；label；selected 樣式用 `data-selected`。
  - resize 用**我們既有**的 `ResizeHandle` + `useFlexibleResize`（會走 `RESIZE_NODE`，有 undo），不要用官方 `NodeResizer`（只改 RF store）。注意 `.frame-resize-line` / `.frame-resize-handle`（`globals.css:388-407`）是 dead CSS，`ResizeHandle` 用的是 Tailwind class，不要期待現成樣式。
  - 手動 resize 的動態最小值 = 內容 bbox + padding；沒有 children 時用 `minWidth: 200 / minHeight: 120`。這樣 children 不會被 resize 擠出框，也不需要「resize 時反推 children」。`useFlexibleResize` 沒有 min prop，min 要在 `FrameNode` 的 `onResize` / `onResizeEnd` clamp。
  - **auto-fit 只做 on-demand**：建立 frame 時依選取 roots 的 bbox + padding 定尺寸；之後 toolbar / context menu 的 `Fit to contents` 重算一次。不要在每个 mousemove 重算，這是上次 jitter 的根因。
  - `NodeToolbar className="nodrag"`：Fit / Detach / Delete；按鈕一律走 Brain command，不用 `deleteElements`。
- `nodeTypes` 加 `frame`（`constants/nodeTypeMap.ts:55-124`）。
- `NODE_DEFINITIONS` 加 `frame`：`minWidth: 200`、`minHeight: 120`、category Utility、`defaultData.label`。
- render order：`useBrainUpdates.ts:239-244` 改成 depth-aware（祖先 depth 小者在前面）；單層時行為不變。
- **單層強制**：attach 只接受 `type === 'frame' && !parentId` 的 target；candidate 不能是 frame、不能已有 parent（從舊 frame reparent 例外）。`validateHierarchy` 的 `maxDepth = 1`（root depth 0），超過就拒絕並回 diagnostic。
- CSS：移除 `.react-flow__node-frame { pointer-events:none !important }`；`.frame-node` 保留；`.frame-node__label` 已有 `pointer-events:none`（`:377`），只需補 toolbar / resize handle。
- **代價**：第一版不支援 frame 巢狀；frame 是視覺分組，不是 Macro（沒有 ports / 封裝），符合程式內 UI-02 註解的定位（`utilityNodes.ts:27`、`globals.css:339`）。

### D5 — 建立 / 解除

- **Attach**：
  - 拖進 frame（D2）。
  - `F` = group：以選取 roots 的 bbox + padding（32px）建 frame，children 轉相對座標。要求 ≥ 2 個 root；若選取含任何 child 或 frame，先拒絕並提示「先 ungroup」。
  - `F` 對「全部是同一 frame 的 direct children」= ungroup。
  - Paste：可選，若游標落在 frame 內就把 roots 掛進去；第一版可先不做。
- **Detach**：
  - toolbar 按鈕。
  - 前置：D2 的 `parentId: null`（`engineTypes.ts:68` + 兩個 reducer）。沒有這個，detach 只會改 UI，下一次 `useBrainUpdates.ts:224` 會把 parent 還原。
  - `F` 對「已群組」的選取 = ungroup（全部轉 absolute、刪 frame）。
  - 不要重用 `Alt`：`Alt` 目前是 disconnect edges（`useSelection.ts:106-138`），語意已佔用。`detachSelected` 只斷 edges，**不是** ungroup，不要拿來當 detach。
- **刪除 frame（已決定：unwrap）**：
  1. 對每個 direct child：`absolute = parentAbs + local`，`parentId = null`，寫入 `MOVE_NODE`。
  2. 移除 frame 本身（`REMOVE_NODE`）。
  3. 同一 BATCH；inverse 先 `ADD_NODE` frame，再對 children 發 `MOVE_NODE { position: originalLocal, parentId: frameId }`。
  4. 若 child 也在選取集合，去重，不要先刪再 unwrap。
  5. 不要用 RF `deleteElements`（它會 cascade，與此決策相反）。
- **單層**：attach 只允許 root frame；不允許 frame 當 child，也不允許 child 當 parent。
- **代價**：不能「拖出框就自動 detach」；必須用明確手勢。

### D6 — 刪除 / 歷史 / 鍵盤

- `useSelection.deleteSelected`（`:22-62`）對 frame 做 **unwrap**：children 轉 absolute + 清 `parentId`，再移除 frame；forward/inverse 都要包含同一組節點，去重。
- **這是既有 bug，不只是 frame 前置**：`FlowCanvas.tsx` 沒有傳 `deleteKeyCode`，React Flow 預設 `'Backspace'`（`@xyflow/react/dist/esm/index.js:3598`）；同一鍵又觸發我們的 `resetSelected`（`FlowCanvas.tsx:571-582`）。RF 的 node remove change 被 `onNodesChangeSafe` 忽略（`:183-223`），結果是 UI 刪、Brain 留。frame 上線前先設 `deleteKeyCode={null}`。
- NodeToolbar 的 Delete 呼叫新的 `deleteNodes([id])` 或「先 select 再 deleteSelected」，不要 `deleteElements`。RF 的 `deleteElements` 會 cascade（`@xyflow/system:504-507` 的 `parentHit`），但依賴 parent 先出現在陣列，且會先送 remove change，正好被我們忽略；cascade 也與 unwrap 決策相反。
- frame resize 走 `RESIZE_NODE`；undo 已會同步 `width/height/measured/style`（`useHistoryExecutor.ts:57-82`）。
- 一致性要顧三處：`confirmGrab`（attach/clamp）、`deleteSelected`（unwrap）、`onNodesChangeSafe`（remove 被忽略）。不要只改其中兩處。
- undo 的 `ADD_NODE` 目前靠 `restoredNodeIndices` splice 回原位（`useHistoryExecutor.ts:124-141`），而 UI 陣列本來就是 parent-first（`useBrainUpdates.ts:239-244`）。保留 splice；只有在 index 缺失時才用 depth sort 補位，兩者不要互相打架。
- **代價**：多一層展開邏輯；刪除成本 O(n)；BATCH 失敗不回滾（`TransactionManager.ts:202-211`），中途失敗會留下半套狀態，需要先驗證或接受。

### D7 — 持久化：schema 不變，但要補載入

- `parentId` / `width` / `height` 已存；不用加 `extent` / `expandParent` / `zIndex`。但現況是「存得下、載不回」：`injectNodes` 丟掉尺寸。
- 修 `Brain.injectNodes`：把 `n.width` / `n.height` 放進 `ADD_NODE` payload（`Brain.ts:1193-1203`）。`AddNodePayload`（`engineTypes.ts:61-62`）與 reducer（`TransactionManager.ts:56-57`）已支援，沒有型別工作。
- 載入時 sanitize：孤兒 `parentId`、self-parent、cycle → 轉 absolute 並清 `parentId`。legacy `data.parentId` 在 `Brain.ts:1187-1191` 只升級不刪，`useProjectSave.ts:153` 仍會把它寫回存檔；載入後應從 `data` 移除。
- 舊 frame 專案的 centered 偏移：沒有可靠版本號（`SCHEMA_VERSION` 仍是 1.0.0），只能選擇接受或加 heuristic。建議第一版接受並在 release note 說明。
- **代價**：無 schema 變更、無 migration；但舊資料可能視覺偏移。

### D8 — 下游整合（可獨立排程）

- **Clipboard**：`useClipboard` 選取時展開 descendants；`clipboardMath` 的 relative/DEC-6 B 已可重用。duplicate 的節點順序要 parent 先。
- **Layout**：
  - 方案 A（建議第一版）：只 layout roots，frame 與其 children 不參與；layout 後不改 parentId。
  - 方案 B：ELK hierarchy（`children` + `elk.hierarchyHandling: INCLUDE_CHILDREN`），工時多 1–2 天。
  - 必修：`useAutoLayout.ts:45-47` 已經有「parent 也在 layout set 內就剔除 child」的 guard；只缺「frame 本身不參與 layout」的 `type === 'frame'` 過濾。
  - 必修：`RE-LAYOUT` 重建 Node（`:189-195`）不帶 `parentId/width/height/origin/style`，MOVE_NODE（`:203-206`）也不帶 `parentId`，最後 `:210 setNodes([...layouted.nodes])` 整批覆蓋。改成 merge-by-id，只更新 position。
- **Knife / Auto-insert / Align / NPanel**：全部改用 absolute helper；`NPanel.tsx:293-297` 的 `handlePositionChange` 目前只 `setNodes`、完全不發 `MOVE_NODE`（會被 Brain sync 蓋回），要先改成 transaction，再談 relative/absolute 顯示。
- **IOGL**：已決定支援（P2.1）。在 P2.1 上線前，encoder 遇到任何 `parentId` 必須 **block + 明確錯誤**，不能把 local 座標當 absolute 寫出；這是資料損壞，不只是失去群組。
- **IOGL 座標文件**：`src/assets/docs/user/05_IOGL/00_iogl-concept.md` 仍寫 `(0,0) is Center`，與 UI top-left 衝突；P0-4 要一併改成 top-left（含 AI system prompt 段）。
- **fitView / minimap / edge routing**：不需改（RF internals 或世界座標）。
- **Read-only**：新增 command 都要走現有 `isReadOnly` 守衛。

---

## 4. 必須改的代碼

### P0 — 座標治根：單一 absolute 產生器（阻擋 frame，可獨立合併）

**目標**：任何檔案想拿 absolute，只能呼叫 `src/utils/coordinates.ts` 或 RF `internals.positionAbsolute`；全 repo 不存在第二個換算公式。

**契約**（實作時同步寫進 `docs/coordinates.md`，並從 `AGENTS.md` 指向它）：

1. `position` = top-left **local**；root 的 local 就是 world。
2. `parentId` 只表達拓撲；**absolute 只推導、不儲存**。
3. `toAbsolute()` / `toParentLocal()` / `reparentPosition()` 是唯一換算；純函式、可測、有 cycle guard。
4. UI 的可信 absolute 是 RF `internals.positionAbsolute`（與 `toAbsolute` 同規則）；engine 用 `toAbsolute`。
5. 陣列順序 parent-first；載入 / attach / undo 後驗 invariant。
6. 不再新增 `origin` 模式；`nodeOrigin` 固定 `[0,0]`。

**PR 切法**（每個 PR 都要能單獨 review / revert）：

| PR | 內容 | 檔案 | 驗收 |
|---|---|---|---|
| P0-1 | 新增純函式與測試，**不改行為** | `src/utils/coordinates.ts`（新）、`tests/unit/utils/coordinates.test.ts`（新） | 1/2/3 層、負座標、orphan、cycle、self-parent、`toParentLocal(toAbsolute(x)) === x`、reparent 拒絕環 |
| P0-2 | Brain 改用 `toAbsolute`，刪除 `- parentW/2`；測試改 top-left | `Brain.ts:1024-1044`、`CoordinateNormalization.test.ts:45-131`、`clipboardMath.ts:8-24` | Brain 與 util 對隨機樹結果一致；bbox 不再偏移 |
| P0-3 | `useHand` 刪本地 `getAbsolutePosition`，改用 RF internals；只移動 roots；scale/rotate 寫回 local | `useHand.ts:50,78-82,89-193,335,430-535` | 拖 parent 只產生 1 筆 `MOVE_NODE`；parent+child 同選不 2×；scale/rotate 後 absolute 不變 |
| P0-4 | 下游呼叫點清掃：knife / auto-insert / align / NPanel / IO encoder；IOGL docs 座標修正 | `useKnife.ts:58-66`、`useAutoInsert.ts:93-124`、`useSelection.ts:212-236`、`NPanel.tsx:288-304`、`Encoder.ts:97-103`、`src/assets/docs/user/05_IOGL/00_iogl-concept.md` | frame 內操作位置正確；NPanel 會發 `MOVE_NODE`；`parentId` 存在時 IOGL **block 匯出**（P2.1 才支援）；IOGL 文件不再寫 center |
| P0-5 | 收尾：`validateHierarchy`、parent-first 排序集中、dev assert、刪 dead code、契約文件 | `coordinates.ts`、`Brain.injectNodes`、`useBrainUpdates.ts`、`docs/coordinates.md` | 壞 parent / cycle 被擋；dev 模式有 assert；grep gate 全過 |

**每個 PR 的 Definition of Done**：

- `npx tsc --noEmit` 通過。
- `npm run test:run` 相關測試通過（`lint` 目前壞，不列入 gate）。
- 手動跑 §6.1 的 1–4 與 9。
- 沒有新增手寫 `parent.position + node.position`。

**P0 完成後的 grep gate**（加進 PR checklist，不一定要寫成測試）：

```sh
rg "position\.x \+ .*position\.x" src        # 只允許 coordinates.ts
rg "parentW|parentH|- .*width / 2|- .*height / 2" src   # 應無命中
rg "internals\.positionAbsolute" src        # 只允許白名單
```

白名單：`coordinates.ts`、`useHand.ts`、`clipboardMath.ts`、debug 元件。

**P0 完成定義（治根驗收）**：

- 全 repo 只有一份 `toAbsolute` 實作；`Brain.getAbsolutePosition` 不再有 size offset。
- 所有 nested caller 都走 internals 或 `coordinates.ts`；flat 專案位置 0 位移。
- nested fixture 的 absolute、拖曳、scale/rotate 全部正確。
- 載入 / attach / undo 後 invariant 通過（parent 存在、無 cycle、parent-first）。

P0-1 先建立 **flat baseline**（只有 root 的專案，位置不得變），再處理 nested；這樣才能區分「修 nested」與「改壞 flat」。

**不要做**：

- 不要把節點全部改存 world；parent 移動時逐一改 child 就是上次 jitter 的來源。
- 不要在 UI 再加一個 offset 去「補」Brain 的中心公式。
- 不要靠 `lint` 當 gate（eslint 10 / typescript-eslint 8 目前不相容）。
- 不要順手做 frame UI；P0 必須能獨立上線。

**風險 / 回滾**：P0 不改 schema；逐 PR revert 即可。`bbox` metadata 會變（目前無消費者）；`useHand` 行為改變最大，需手動 regression。

### P0.5 — Frame 前置：資料與刪除（P0 之後、P1 之前）

| 檔案 | 改動 | 風險 |
|---|---|---|
| `src/engine/types/engineTypes.ts:68` + `TransactionManager.ts:140-144` + `useHistoryExecutor.ts:46-55` | `parentId?: string \| null`；用 `'parentId' in p` 判斷（detach 前置） | 高：沒改就沒有 detach |
| `src/components/FlowCanvas.tsx:660-741` | `deleteKeyCode={null}`（既有 Backspace 雙重觸發 bug，見 §3-D6） | 中：現行 UI/Brain 可能已 desync |
| `src/engine/Brain.ts:1193-1203` | `injectNodes` 轉交 `width/height`；orphan/cycle sanitize | 低：型別與 reducer 已支援 |

### P1 — Frame 核心

| 檔案 | 改動 |
|---|---|
| `src/components/nodes/FrameNode.tsx`（新） | label、選取樣式、`ResizeHandle`（動態 min）、`NodeToolbar`（Fit/Detach/Delete）、`nodrag` |
| `src/constants/nodeTypeMap.ts:55-124` | `'frame': FrameNode` |
| `src/types/nodeDefinitions.ts` | frame definition（min size / category / defaultData） |
| `src/app/globals.css:338-344` | 移除 `pointer-events:none !important`；補 toolbar / label CSS |
| `src/hooks/useFrameActions.ts`（新） | `groupSelected`（建立時 auto-fit）/ `ungroupSelected` / `detachNodes` / `attachNodes` / `fitFrameToContents`；改寫官方 `useDetachNodes` + `getNodePositionInsideParent`，寫入走 Brain |
| `src/hooks/nerves/useHand.ts:430-535` | `confirmGrab` 加 attach/clamp；**只允許 root frame**；exclude ancestors；smallest-area 選擇 |
| `src/hooks/useSelection.ts:22-62` | frame 刪除 **unwrap**：children 轉 absolute + 清 `parentId`；forward/inverse 一致；dedupe |
| `src/constants/shortcuts.ts:76-82` + `FlowCanvas.tsx:407-584` | 接上 `nodes:bundle` → group/ungroup；ContextMenu 加 Group/Ungroup/Detach。注意 shortcut label 是 `Frame Selected`、StatusBar 是 `F: Group`，先統一文案 |
| `src/hooks/useBrainUpdates.ts:139-151,239-244` | depth-aware 排序；zIndex 規則保留 |
| `src/hooks/useHistoryExecutor.ts:35-82,124-141` | 保留 index splice；index 缺失時才 depth sort；`RESIZE_NODE` 還原 frame 尺寸；unwrap 的 inverse 還原 `parentId` + local |

### P2 — 下游整合

| 檔案 | 改動 |
|---|---|
| `src/hooks/layoutEngine.ts:56-81` + `useAutoLayout.ts:45-47,189-210` | 方案 A：layout 排除 frame/children；RE-LAYOUT 改 merge-by-id、保留 parentId |
| `src/hooks/useClipboard.ts:36,75` | 選 frame 連帶 descendants |
| `src/hooks/useKnife.ts:58-66` | absolute helper |
| `src/hooks/useAutoInsert.ts:93-124` | absolute helper |
| `src/hooks/useSelection.ts:212-236` | align 用 absolute（不同 parent 不可直接比 relative） |
| `src/components/ui/NPanel.tsx:288-304` | 顯示/輸入 relative + absolute（P0-4 已把寫入改成 `MOVE_NODE`） |
| `src/engine/iogl/Encoder.ts:97-103` / `Parser.ts:473-481` | P2.1：`FRAME` + `parent` 語法；encoder pre-pass、parser 兩段解析；docs 更新 |
| `tests/` | 新增 §6 的案例 |

### P2.1 — IOGL 支援 frame（建議語法）

**結論**：要支援，否則是資料損壞：目前 encoder 把 child 的 local `position` 寫成 `@x,y`，parser 又當 absolute 讀，round-trip 會位移一個 parent offset。frame 只是讓這個既有 bug 變得常見。

**語法**（IOGL 1.1；不用 block，維持一行一 declaration）：

```iogl
[Group 1] FRAME {400,300} @100,100
[num] IN-01 42 {parent: "Group 1"} @20,20
[res] OT-01 {parent: "Group 1"} @20,120

[num].a -> [res].a
```

- `FRAME` 是 `frame` 的 IOGL alias；`{W,H}` 沿用既有 dimension shorthand。
- `parent` 是 reserved prop，值是 frame 的 **label**；parser 在全部節點建立後才解析，因此 frame 可以出現在 child 之後。
- child 的 `@x,y` 維持 **local**；frame 的 `@x,y` 是 world。這正好符合 UI 儲存格式。
- 只允許一層：`parent` 指向的節點必須是 `frame` 且自己沒有 `parentId`；child 不能是 frame。

**Parser 改動**（`Parser.ts`）：

1. `parseNode` 不需要改；`parent` 會進 `raw.props`。
2. `buildGraph` Step 1 後建 `finalNodeById`。
3. Step 1.5：走訪 `this.nodes`，讀 `raw.props.parent`，`labelToId` → `tempToFinal` 解析成 `parentId`；從 `data` 移除 `parent`。
4. 驗證：unknown parent、parent 不是 frame、parent 自己也有 parent、child 是 frame → 全部 diagnostic + 不建立 parentId。
5. 最後 parent-first 排序。

**Encoder 改動**（`Encoder.ts`）：

1. 先 pre-pass 建 `idToLabel`（目前是邊走邊建，parent 在後面時拿不到 label）。
2. frame 輸出 `FRAME` + `{W,H}` + `@x,y`。
3. child 的 props 加入 `parent: "<frame label>"`；`@x,y` 照舊寫 local。
4. 若 `parentId` 找不到 parent 或 parent 不是 frame，**丟錯並中止匯出**，不要靜默寫出壞資料。

**Manifest / 定義**：`IOGL_MANIFEST` 加 `frame: { auxiliary: ["width", "height"] }`；frame 的 `NODE_DEFINITIONS` 加 `aliases: ['frame']`，讓 `FRAME` 能解析。

**文件**：`src/assets/docs/user/05_IOGL/00_iogl-concept.md` 加 FRAME / parent 段，並把 `(0,0) is Center` 改成 top-left（含 AI system prompt）。

**測試**：frame + 2 children round-trip（位置、parentId、尺寸）；舊 IOGL（無 parent）仍 flat；unknown/non-frame/nested parent 全部 diagnostic；frame 無 label 時 child 不能引用。

**工時**：約 1–1.5 天；不改 UI，只動 parser/encoder/manifest/docs。

**為什麼不用 block 語法**：

```iogl
frame "Group 1" {
  [num] IN-01 42 @20,20
}
```

lexer 目前 `{}` 已用於 props 與 `{W,H}`；block 需要處理 NEWLINE 與縮排、parser 要重寫 declaration 邊界，AI 生成也更容易錯。`parent` 屬性是 backward-compatible、最小改動。

---

## 5. 我們要犧牲什麼

| # | 犧牲 | 影響 | 嚴重度 | 替代 |
|---|---|---|---|---|
| 1 | 拖出框自動 detach | 拖到邊界會 clamp；要按 Detach / F | 中 | toolbar + `F` ungroup |
| 2 | live auto-fit（每幀重算） | 只有建立時 + on-demand `Fit to contents`；拖 child 時 frame 不會自動長大 | 低 | toolbar 按鈕；避免上次 jitter |
| 3 | frame 巢狀 | 已決定單層；frame-in-frame 直接拒絕 | 中 | 未來 depth-aware 全鏈路再開 |
| 4 | RF 原生拖曳 / `extent` / `expandParent` | 不能直接用官方 `onNodeDrag*`；containment 自己算 | 中 | 保留 `useHand` 的 snap / axis lock / autopan |
| 5 | 扁平 layout 假設 | 自動 layout 要跳過 frame，或另寫 hierarchy | 中 | 方案 A 先上，方案 B 後補 |
| 6 | IOGL 1.0 沒有 frame 語法 | 不改格式就會遺失群組，且 local 座標被當 absolute | 中 | `FRAME` + `parent`（§4 P2.1）；未實作前 encoder 要 guard |
| 7 | nested 選取的 SCALE/ROTATE | frame + child 同時選取時直接縮放語意複雜 | 中 | 第一版對含 frame 的選取禁用 S/R，或只作用 roots |
| 8 | Frame 不是 Macro | 沒有 ports、沒有邏輯封裝，線仍可跨框 | 低 | 維持 UI-02 定位；Macro 另案 |
| 9 | 舊 center-era frame 專案 | 可能偏半個 parent 尺寸 | 中 | release note；必要時 heuristic migration |
| 10 | 存檔不含 `extent/expandParent` | 外部工具或未來 RF drag 無法還原 containment | 低 | 我們的 clamp 不依賴它 |
| 11 | 效能 | frame 內大量 children 時，拖曳 clamp/交集測試是 O(children) | 低 | 只測 frame 候選（通常 < 20） |
| 12 | 刪 frame 不 cascade | children 留在畫布轉 independent，需要使用者自行刪 | 低 | 明確文案；undo 可還原 |
| 13 | 手動 resize 不能小於內容 | frame 最小尺寸受 children bbox 限制 | 低 | 先 detach / 縮小 children |

---

## 6. 驗收與測試

### 6.1 手動情境

1. 選 3 個節點 → `F`：出現 frame，children 相對位置不變。
2. 拖 frame：children 跟著移動；放手後 `Brain` 只有 frame 的 `MOVE_NODE`。
3. 拖 child 到框邊：停在框內；不會出現 2× 位移或回彈。
4. Detach：child 停在原視覺位置，`parentId` 清空。
5. 刪 frame：children 留在原位、`parentId` 清空；undo 還原 frame、尺寸與親子關係。
6. 存檔 → reload：frame 尺寸、label、children 相對位置一致。
7. Copy frame → paste：children 一起來；貼在游標中心。
8. 自動 layout：frame 與 children 不被拆散。
9. 舊專案（無 frame）load：位置與現在一致。
10. Read-only：不能 group/ungroup/detach/delete。
11. frame + child 一起選取拖曳：child 只位移 1×，放手後 Brain 只更新 frame。
12. frame 內 child 做 SCALE/ROTATE：視覺位置不跳，absolute 不變。
13. `Fit to contents`：frame 貼合 children，children absolute 不變。
14. 把 frame 拖進另一個 frame：被拒絕，log 明確。
15. IOGL 匯出 → 匯入：frame、children、相對位置全部保留（P2.1 後）。

### 6.2 單元 / 整合測試

- `src/utils/coordinates.ts`：1/2/3 層、負座標、orphan、cycle、self-parent、`toParentLocal(toAbsolute())` round-trip、reparent 拒絕條件、orphan 子樹 parent-first。
- `Brain.getAbsolutePosition` 與 util 對隨機樹（含巢狀）結果一致。
- `useHand`：拖 parent 只 1 筆 `MOVE_NODE`；parent+child 同選不 2×；frame 內 scale/rotate 後 absolute 不變。
- `Brain.getAbsolutePosition`：top-left、兩層、cycle。
- `confirmGrab` attach：absolute → relative、clamp、最小面積選擇、ancestor 排除。
- detach math：與 `clipboardMath` 同一組 fixture。
- 刪 frame unwrap：children absolute 不變、`parentId` 清空；undo 還原 frame + parentId + local；forward/inverse 與 splice 一致。
- auto-fit：`fitFrameToContents` 後 children absolute 不變，frame bbox = content + padding。
- 單層：frame-in-frame、child-as-parent、超過 depth 2 都被 validateHierarchy 拒絕。
- IOGL round-trip：`FRAME` + `{parent}` 解析後 parentId 正確；舊 IOGL（無 parent）仍可讀。
- detach：`parentId: null` 真的寫進 Brain；下一次 graphChanged 不會被還原。
- Backspace：不會同時 reset data 與觸發 RF 原生 remove（UI/Brain 一致）。
- depth sort：grandchild 不會排在 parent 前。
- save/load round-trip：`parentId` / `width` / `height` 保留。
- clipboard：選 frame 自動包含 descendants。
- `RegistryStability`：`frame` 已在白名單。

---

## 7. 風險與回滾

- **P0 回滾**：5 個 PR 可逐一 revert；不改 schema、不改存檔格式，也不依賴新套件。唯一會變的是 bbox metadata 與 nested transform 行為。
- **Frame 回滾**：不是只拔 `nodeTypes['frame']`。還原要三處：`nodeTypes` entry、`globals.css:342-344` 的 `pointer-events:none`、`confirmGrab` 的 attach 邏輯。`parentId` 資料仍在，舊專案不會壞。
- **座標修正風險**：`Brain.getAbsolutePosition` 目前只污染 bbox metadata（尚無消費者），但 P0 仍要跑 layout/routing 回歸，避免未來接上時才爆。
- **BATCH 不是 transaction**：`TransactionManager.ts:202-211` 逐筆套用，失敗不回滾。frame unwrap / attach 的批次要先驗證，否則會留半套。
- **forward/inverse 不對稱**：`confirmGrab` 的 forward 只含 `movedNodeIds`，inverse 含整個 `initialPositions`；展開 descendants 後要一起對齊，否則 undo 會多寫。
- **三處一致性**：attach/clamp（`confirmGrab`）、unwrap（`deleteSelected`）、remove 忽略（`onNodesChangeSafe`）必須同時處理。只改兩處會出現「UI 刪了、Brain 還在」。
- **版本**：官方用 12.12.0，我們 12.10.2；本方案用到的 `getIntersectingNodes`、`NodeToolbar`、`getInternalNode`、`internals.positionAbsolute` 在 12.10.2 都存在。**不需要升級**（升級反而要重跑 React 19.2.4 相容性）。
- **CSP / Vercel**：無新依賴、無 CDN，維持現行部署。
- **歷史教訓**：不要再做「每 frame 重算 bbox 並反向平移 children」；官方模型是 parent 帶 child，不是 child 撐 parent。這正是上次 jitter 的來源。
- **不要做 sticky 100px**：上次 `confirmGrab` 的 sticky 緩衝造成「拖出去又彈回」。第一版用明確 clamp + 明確 detach。

---

## 8. 已拍板 / 待確認

已決定（2026-11-13）：

1. **拖出框**：clamp 在框內；不做 drag-out detach。Detach 只走 toolbar / `F`。
2. **刪 frame**：不 cascade。children 轉 independent（absolute + 清 `parentId`），frame 單獨移除；undo 需還原 frame 與親子關係。
3. **frame 尺寸**：手動 resize + **on-demand** auto-fit。建立 frame 時自動貼合內容；之後用 toolbar / context menu 的 `Fit to contents`。**不做每幀 live auto-fit**（上次 jitter 的來源）。
4. **巢狀**：只做單層（root frame + direct children）。frame-in-frame、child 當 parent 一律拒絕。
5. **IOGL**：建議支援，但不改 block 語法；用 `FRAME` 宣告 + `{parent: "frame label"}` 屬性。詳見 §4 P2.1。**這一點待你確認語法**。

尚未決定：IOGL 的 `FRAME` / `parent` 命名是否接受；若否，替代是匯出時攤平 + warn（會失去群組）。

---

## 附錄 A — 官方 vs 我們（對照）

| 概念 | 官方 | 我們 |
|---|---|---|
| group node | `type: 'group'`（built-in） | `type: 'frame'`（custom） |
| 拖曳 | RF native | `useHand` |
| attach 時機 | `onNodeDragStop` | `confirmGrab` |
| 邊界 | `extent: 'parent'` | 自訂 clamp |
| detach | NodeToolbar | NodeToolbar + `F` |
| 選取 | RF default | `useSelection` + `onNodesChangeSafe` |
| 儲存 | 範例不存 | Brain + Serializer（`parentId` 已支援） |
| 刪除 | `deleteElements`（cascade） | `deleteSelected` + frame unwrap（children 轉 independent） |

## 附錄 B — 上次失敗的一句話總結

> 把 frame 當成「會自動長大的容器」，每次移動都重算 bbox 並反向平移 children；再叠加 center-origin、`extent` crash、`data.parentId` 與 top-level `parentId` 不同步，最後整個功能被移除。

這次改成官方模型：**frame 是普通 parent，children 只存相對座標，parent 移動由 React Flow 帶動；containment 用 clamp，不用 `extent`。**
