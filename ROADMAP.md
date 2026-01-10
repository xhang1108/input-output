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
- [x] **Performance & Optimization**
    - [x] **Engine Debounce:** Optimize `useBrain` to skip hash calculation during drag frames.
    - [x] **Edge Rendering:** Refactor `CustomEdge` to use `edge.data.isFormula` instead of expensive `getNode()` lookups for styling.
    - [x] **Frame Cache:** Implement memoization in `Brain.ts` for recursive evaluation.

---

## ✅ Phase 2: Hybrid Pull Architecture (Completed)
**Goal:** Implementation of "Push Signal, Pull Data" Engine.

- [x] **Core Engine Rewrite**
    - [x] **PullEngine.ts:** Implement recursive `pullValue` with cycle detection in `Brain.ts`.
    - [x] **Payload Standard:** Define `NodePayload` structure.
    - [x] **Safety:** Implement `FALLBACK_PAYLOAD` and error handling.
- [x] **Node Architecture v2**
    - [x] **Smart Result Node:** Logic nodes trigger calculation via `pullValue`.
    - [x] **Lazy Intermediates:** Nodes only calculate when pulled (Dead Code Elimination).
    - [x] **Scoped Flow:** Wires carry variable tables (`scope`) for formula generation.
- [x] **Migration**
    - [x] Deprecate `Brain.think()` (Monolithic Push).
    - [x] Verify `ResultNode` handles Cycles gracefully without crashing.
- [x] **Logic Nodes Implementation**
    - [x] **Component:** Create `src/components/nodes/NodeLogic.tsx`.
    - [x] **Ops:** AND, OR, XOR, NAND.
    - [x] **Ghost Inputs:** Logic nodes handle empty inputs as `false`.
- [x] **Comparison Operations**
    - [x] **Component:** Create `src/components/nodes/NodeCompare.tsx`.
    - [x] **Ops:** `>`, `<`, `=`, `!=`, `>=`, `<=`.
    - [x] **Visual Feedback:** LED indicator (Green=True, Red=False).
- [x] **Control Flow (Switch/If)**
    - [x] **Implementation:** Created `NodeSwitch.tsx`.
    - [x] **Data Logic:** Implemented ternary formula and lazy branch pulling in `Brain.ts`.

---

## 🚧 Phase 3: Visuals & Polish (Current Focus)
**Goal:** Enhance the user interface and graph management tools.

- [x] **Sticky Placement (Blender Style)**
    - [x] **Shift+D**: Implemented spawn-in-place + relative sticky movement.
    - [x] **Ctrl+V**: Standard mouse-centered paste (non-sticky).
    - [x] **Race Condition Fix**: Ensured 100% activation reliability by passing node refs directly.
- [x] **Keyboard Shortcuts Audit:**
    - [x] 1. Verify operation of all existing shortcuts.
    - [x] 2. Implement new shortcuts for improved workflow (Fit View, Focus).
    - [x] 3. **Copy-Paste with Edges**: Ensure connected edges are also copied when multiple nodes are selected and pasted.
- [x] **Graph Layout Engine**
    - [x] **Library:** Integrated `elkjs` via `useLayout` hook.
    - [x] **Strategy:** Used `elk.layered` algorithm respecting ports.
    - [x] **UI:** Added "Layout" button in the Panel.
- [x] **Navigation & A11y**
    - [x] **Minimap:** Added `<Minimap />` with custom node colors.
    - [ ] **Keyboard:** Ensure `useEar` handles Focus Management.

---

## 🧮 Phase 4: Advanced Mathematics
**Goal:** Support engineering workflows.

- [x] **Scientific Functions**
    - [x] **Library:** Leveraged `mathjs`.
    - [x] **Node:** Expanded `NodeUnary.tsx` to include `sin`, `cos`, `tan`, `log`, etc.
    - [x] **UI:** Added a dropdown to select functions.
- [ ] **Custom Functions (Subgraphs)**
    - [ ] **Architecture:** Define a `MacroNode` type that holds a nested `nodes` and `edges` state.
    - [ ] **Execution:** `Brain.ts` needs to recursively call a `pullValue` sub-routine for these nodes.

---

## 📊 Phase 5: Data Structures (The "Spreadsheet" Upgrade)
**Goal:** Handle collections of data (Arrays/Matrices).

- [ ] **Matrix Engine Support**
    - [x] **MathJS:** Switch internal operations from native JS (`a + b`) to `math.add(a, b)` to support matrix addition automatically.
    - [ ] **Type Guard:** Update `CustomEdge.tsx` to detect `Array` values and render a "Double Line" or "Thick Wire" style.
- [ ] **UI Visualization**
    - [ ] **Output Node:** If `value` is Array, render a small HTML `<table>` or grid instead of a single number.
    - [ ] **Spreadsheet Node:** A new input node allowing CSV-style data entry.

## 🛠️ Phase 6: Engineering Health
**Goal:** Maintain stability at scale.

- [ ] **Testing Strategy**
    - [ ] **Unit:** Add `vitest` to test `Brain.pullValue()` with various graph topologies (Cyclic, Disconnected, Type Errors).
    - [ ] **E2E:** Playwright tests to verify "Drag from Handle" works on canvas.
- [ ] **Performance (Web Workers)**
    - [ ] **Refactor:** Move `Brain.ts` into a `brain.worker.ts`.
    - [ ] **Comms:** Use `postMessage` to send `nodes/edges` and receive `results`, keeping the UI thread unblocked.

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

## 🧬 Phase 9: Simulation & Macros (Blender 5.0 Architecture)
**Goal:** Introduce programmability, loops, and time-based simulation.

- [ ] **Simulation Zones (Time Travel)**
    - [ ] **Concept:** Allow `Result(Frame t)` to be fed into `Input(Frame t+1)`.
    - [ ] **Architecture:** Implement a **Simulation Zone** (Input/Output pair). Nodes inside execute once per frame.
    - [ ] **State Cache:** Need a "Cache Manager" in `Body.tsx` to store the history of simulation steps.
- [ ] **Functional Closures (Macros)**
    - [ ] **Concept:** Pass *logic* instead of *values*.
    - [ ] **Implementation:** Wires can carry a `(x) => y` function payload.
    - [ ] **Use Case:** Custom "Loop" nodes that run a connected subgraph 100 times.
- [ ] **Data Bundles (Structs)**
    - [ ] **Concept:** Clean up spaghetti wires by bundling related data.
    - [ ] **Implementation:** A single wire carries `{ pos: Vec3, vel: Vec3, mass: Number }`.
    - [ ] **Nodes:** `Pack Bundle` and `Unpack Bundle` nodes.
