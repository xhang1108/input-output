# 🗺️ Calctopus Roadmap

This roadmap outlines the past achievements and future ambitions for **Calctopus**, the high-performance node-based calculator.

## ✅ Phase 1: Foundation (Completed)
**Goal:** Establish a robust Next.js/React Flow architecture.

- [x] **Core Architecture**
    - [x] Next.js 14+ / React Flow Integration.
    - [x] **Separation of Concerns:** `Brain.ts` (Pure Logic) vs `Body.tsx` (React Render).
- [x] **Interaction Model**
    - [x] **Blender Detachment:** `onReconnect` logic for dragging input edges.
    - [x] **Nerves System:** Custom hooks (`useBrain`, `useHand`, `useEar`) for event handling.
- [x] **Persistence**
    - [x] `localStorage` sync via `useMouth`.

---

## 🚧 Phase 2: Logic & Control (Current Focus)
**Goal:** Transform Calctopus into a Visual Programming Language (VPL).

- [ ] **Engine Refactor: Type Safety**
    - [ ] **Brain.ts:** Remove aggressive `Number()` casting in `think()` to allow `boolean` and `object` types to propagate.
    - [ ] **Thoughts Interface:** Update `Thoughts` record to support `value: number | boolean`.
    - [ ] **Error Handling:** Add explicit "Type Mismatch" errors when `MathNode` receives a boolean.
- [ ] **Logic Nodes Implementation**
    - [ ] **Component:** Create `src/components/nodes/NodeLogic.tsx`.
    - [ ] **Props:** `operation: 'AND' | 'OR' | 'XOR' | 'NAND'`.
    - [ ] **Ghost Inputs:** Logic nodes must treat unconnected inputs as `false` (0) rather than `NaN`.
- [ ] **Comparison Operations**
    - [ ] **Component:** Create `src/components/nodes/NodeCompare.tsx` (Separate from MathNode for clarity).
    - [ ] **Ops:** `>`, `<`, `=`, `!=`, `>=`, `<=`.
    - [ ] **Visual Feedback:** Implement a small LED indicator on the node body showing the current boolean state (Green=True, Red=False).
- [ ] **Control Flow (Switch/If)**
    - [ ] **Implementation:** Create `NodeSwitch.tsx`.
    - [ ] **Data Logic:** If the switch is "Off", the output should propagate a special `Signal.NO_VALUE` or `null` which downstream nodes must handle (or ignore).

## 🎨 Phase 3: Visuals & Polish
**Goal:** Enhance the user interface and graph management tools.

- [ ] **Graph Layout Engine**
    - [ ] **Library:** Integrate `elkjs` (Eclipse Layout Kernel) via a new `useLayout` hook.
    - [ ] **Strategy:** Use `elk.layered` algorithm which respects ports (unlike `dagre`), ensuring inputs stay on the left.
    - [ ] **UI:** Add "Auto Layout" button in the Panel.
- [ ] **Navigation & A11y**
    - [ ] **Minimap:** Add `<Minimap />` from `@xyflow/react` with custom `nodeColor` prop mapped to node types (e.g., Math=Orange, Input=Blue).
    - [ ] **Keyboard:** Ensure `useEar` handles Focus Management so users can Tab between nodes.

## 🧮 Phase 4: Advanced Mathematics
**Goal:** Support engineering workflows.

- [ ] **Scientific Functions**
    - [ ] **Library:** Leverage `mathjs` for all heavy lifting.
    - [ ] **Node:** Expand `NodeUnary.tsx` to include `sin`, `cos`, `log`, `exp`.
    - [ ] **UI:** Add a dropdown to select the function, updating the node label dynamically.
- [ ] **Custom Functions (Subgraphs)**
    - [ ] **Architecture:** Define a `MacroNode` type that holds a nested `nodes` and `edges` state.
    - [ ] **Execution:** `Brain.ts` needs to recursively call a `think()` sub-routine for these nodes.

## 📊 Phase 5: Data Structures (The "Spreadsheet" Upgrade)
**Goal:** Handle collections of data (Arrays/Matrices).

- [ ] **Matrix Engine Support**
    - [ ] **MathJS:** Switch internal operations from native JS (`a + b`) to `math.add(a, b)` to support matrix addition automatically.
    - [ ] **Type Guard:** Update `CustomEdge.tsx` to detect `Array` values and render a "Double Line" or "Thick Wire" style.
- [ ] **UI Visualization**
    - [ ] **Output Node:** If `value` is Array, render a small HTML `<table>` or grid instead of a single number.
    - [ ] **Spreadsheet Node:** A new input node allowing CSV-style data entry.

## 🛠️ Phase 6: Engineering Health
**Goal:** Maintain stability at scale.

- [ ] **Testing Strategy**
    - [ ] **Unit:** Add `vitest` to test `Brain.think()` with various graph topologies (Cyclic, Disconnected, Type Errors).
    - [ ] **E2E:** Playwright tests to verify "Drag from Handle" works on canvas.
- [ ] **Performance (Web Workers)**
    - [ ] **Refactor:** Move `Brain.think()` into a `brain.worker.ts`.
    - [ ] **Comms:** Use `postMessage` to send `nodes/edges` and receive `thoughts`, keeping the UI thread unblocked.

## ☁️ Phase 7: Cloud & Community
**Goal:** Sharing and Storage.

- [ ] **Serialization**
    - [ ] **Compression:** Use `lz-string` to compress the JSON graph before encoding into the URL hash for easy sharing.
- [ ] **Backend**
    - [ ] **Supabase:** Simple `graphs` table with `id`, `user_id`, and `json_data` columns.
