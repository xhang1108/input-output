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
- [ ] **Performance & Optimization**
    - [x] **Engine Debounce:** Optimize `useBrain` to skip hash calculation during drag frames.
    - [ ] **Edge Rendering:** Refactor `CustomEdge` to use `edge.data.isFormula` instead of expensive `getNode()` lookups for styling.

---

## 🚧 Phase 2: Hybrid Pull Architecture (Current Focus)
**Goal:** Implementation of "Push Signal, Pull Data" Engine.

- [ ] **Core Engine Rewrite**
    - [ ] **PullEngine.ts:** Implement recursive `getValue` with cycle detection.
    - [ ] **Payload Standard:** Define `{ formula, scope, display, val }` structure.
    - [ ] **Safety:** Implement `FALLBACK_PAYLOAD` (Zero) and `try-catch` error handling.
- [ ] **Node Architecture v2**
    - [ ] **Smart Result Node:** The only node that triggers calculation (via `math.evaluate`).
    - [ ] **Lazy Intermediates:** Math/Logic nodes only calculate when pulled by a Result node.
    - [ ] **Scoped Flow:** Wires carry variable tables (`scope`), not just numbers.
- [ ] **Migration**
    - [ ] Deprecate `Brain.think()` (Monolithic Push).
    - [ ] Verify `ResultNode` handles Cycles gracefully without crashing.
- [x] **Logic Nodes Implementation**
    - [x] **Component:** Create `src/components/nodes/NodeLogic.tsx`.
    - [x] **Ops:** AND, OR, XOR, NAND.
    - [x] **Ghost Inputs:** Logic nodes handle empty inputs as `false`.
- [x] **Comparison Operations**
    - [x] **Component:** Create `src/components/nodes/NodeCompare.tsx`.
    - [x] **Ops:** `>`, `<`, `=`, `!=`, `>=`, `<=`.
    - [x] **Visual Feedback:** LED indicator (Green=True, Red=False).
- [ ] **Control Flow (Switch/If)**
    - [ ] **Implementation:** Create `NodeSwitch.tsx`.
    - [ ] **Data Logic:** If the switch is "Off", the output should propagate a special `Signal.NO_VALUE` or `null`.

## 🐛 Known Issues / Polish
- [ ] **Sticky Placement:** `Shift+D` (Duplicate) and `Ctrl+V` (Paste) should attach nodes to the mouse cursor for immediate placement. Currently, they paste at the cursor but do not "stick" for dragging.
- [ ] **Keyboard Shortcuts Audit:**
    - [ ] 1. Verify operation of all existing shortcuts.
    - [ ] 2. Implement new shortcuts for improved workflow.

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

## 🔮 Phase 8: Symbolic & Constraint Intelligence
**Goal:** Transform Calctopus from a Calculator to a Computational Engine.

- [ ] **Omni-directional Nodes (Constraint Solver)**
    - [ ] **Concept:** Nodes with no fixed inputs/outputs. Ports adapt based on data flow.
    - [ ] **Implementation:** Input `PV = nRT`. The node exposes 5 ports. Connect any 4 variables, and the 5th becomes the output.
    - [ ] **Dynamic Solving:** Real-time re-balancing of the equation tree based on what is known vs. unknown.
- [ ] **Symbolic Data Flow**
    - [ ] **Expression Propagation:** Wire carries `Symbol("x")` or `Expression("sin(x^2)")` instead of just numbers.
    - [ ] **Computer Algebra System (CAS):** Nodes calculate symbolic derivatives, integrals, or simplifications.
    - [ ] **Visual Proofs:** Show the step-by-step transformation of a formula as it passes through the graph.
