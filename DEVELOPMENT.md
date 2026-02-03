# 🧙 Calctopus Development Guide & Black Magic

This document details the internal architecture, hidden logic ("Black Magic"), and specific implementation details that maintain the stability of Calctopus. Read this before refactoring core components.

## 🧠 Core Architecture: The Hybrid Pull Model

Calctopus uses a **Decoupled Reactive Loop** to ensure that complex mathematical calculations never lag the user interface.

### 1. The Nervous System (`src/nerves/`)
The Body and Brain communicate via specialized hooks. **Crucial:** All these hooks must return memoized objects to prevent React re-render cascades.

-   **`useHand` (Motor Nerve):** Manages user interactions like grabbing, copying, pasting, and duplicating nodes.
-   **`useEar` (Sensory Nerve):** Listens for global keyboard shortcuts and mouse movements.
-   **`useEye` (Sensory Nerve):** Manages vision and viewport (Focus, Zoom, Pan).
-   **`useMemory` (Hippocampus):** Responsible for short-term memory (Undo/Redo command stack).
-   **`useMouth` (Communication Nerve):** Handles long-term persistence (Auto-save) and file IO/Serialization.
-   **`Brain` (Engine):** The central processing unit. Handles dependency resolution, task scheduling, and mathematical execution via Workers.

### 2. The Biological Protocol (Nerve Decoupling Rules)
To prevent "Refactor Hell" and ensure the project remains maintainable (unlike the legacy Svelte version), all Nerves must follow these strict boundary rules:

1.  **Sensory vs. Motor Separation:**
    *   **Sensory Nerves (`useEar`, `useEye`)** only **Listen**. They should contain zero logic for *how* to change data. They capture intent (e.g., "G key pressed") and delegation (e.g., `hands.grab()`).
    *   **Motor Nerves (`useHand`)** only **Act**. They should never contain `addEventListener`. They provide methods for others to call.
2.  **No Direct Cross-Talk:** Nerves should not call each other directly inside their internal logic if possible. They should be coordinated by the **Body** (`Body.tsx`) or via passed references.
3.  **The "Reflex" Rule (Alerts):**
    *   Nerves are allowed to trigger "Reflexes" (Toasts/Notifications) using `sonner`.
    *   **Motor Reflexes:** `useHand` toasts when an action completes (e.g., "Pasted").
    *   **Sensory Warnings:** `Body.tsx` toasts when it detects a structural violation (e.g., "Loop detected").
4.  **No Domain Leakage:**
    *   `useHand` should not know about DOM IDs or CSS classes.
    *   `useEar` should not know about MathJS or Bounding Boxes.
    *   `useEye` should not know about Node Data.

### 2. The Cycle of Reactivity (V4: Optimized Pull)
1.  **Visual Change (Drag/Select):** Handled entirely by React Flow and local state. No calculation is triggered.
2.  **Logical Change (Type/Connect):** Any data-altering action calls `triggerLogicUpdate()`.
3.  **The Signal:** The global `logicVersion` (Zustand) increments.
4.  **The Cache Clear:** `clearCache()` is collected to prepare for a fresh frame.
5.  **Smart Liveness Check (Dead Code Elimination):** Before pulling, every node runs `isNodeAlive()` to verify if it contributes to a Sink (Output/Monitor). Disconnected chains are strictly ignored to save resources.
6.  **The Pull:** Active nodes initiate a **Lazy Pull**.
7.  **Recursion + Memoization:** `Brain.ts` runs `_pullValue()`, ...
7.  **Expression:** Results are displayed instantly.

### 3. Forward Flow, Backward Calculation
-   **Visual Flow:** Edges look like they flow forward (Input -> Math -> Output).
-   **Data Pull:** The engine calculates **Backward**. To find an Output's value, it "pulls" from its parents, who pull from their parents. This naturally handles variable scoping and dependencies without needing a Topological Sort.

---

## 🔮 Black Magic (Critical Implementation Details)

### 1. Positional Re-render Blocking (The "Drag-Lag" Cure)
**Problem:** React Flow passes new `x/y` coordinates to every node on every move frame. Standard `React.memo` fails because the `position` prop changes constantly.
**The Fix:**
All node components use a **Custom Memo Comparison**. We explicitly ignore position changes:
```typescript
}, (prev, next) => (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data === next.data
));
```
**Result:** Only the node's "wrapper" moves geographically. The internal JSX (icons, math, labels) stays static and does not re-render until the data actually changes.

### 2. Frame-Level Memoization
**Problem:** A deep tree with shared sub-branches (e.g. output depends on A and B, which both depend on C) would lead to exponential calculation time.
**The Fix:**
`Brain.ts` maintains a `frameCache` (Javascript Map). Every node's result is calculated once per logic version and reused.
```typescript
if (frameCache.has(nodeId)) return frameCache.get(nodeId)!;
```

### 2. Recursive Cycle Protection
**Problem:** A graph loop (A->B->A) would cause a `Stack Overflow` in a recursive pull model.
**The Fix (`Brain.ts`):**
We pass a `visited` Set through the recursion. If we hit a node already in the Set, we return a `Loop` payload instead of continuing.

### 3. Variable Namespacing (`v_`)
**Problem:** MathJS has built-in functions (like `sin`, `cos`) that might collide with user variable names.
**The Fix (`Brain.ts`):**
All user-defined variables are prefixed with `v_` (e.g., `x` becomes `v_x`) before being passed to the MathJS evaluator.

### 4. Hook Stabilization
**Problem:** If `useHand` returns a new object `{...}` on every render, it breaks `memo()` for all sub-components.
**The Fix:**
All nervous system hooks use `useMemo` for their return objects to ensure referential stability.

### 5. Physical Auto-Insertion (The "Snap" Effect)
**Problem:** Manually reconnecting wires when adding a node is tedious.
**The Fix (`Body.tsx`):**
When a node is dropped, we calculate the distance to all existing edges using `distanceToSegment`. If the node is within a short threshold (30px), we automatically:
1. Split the edge.
2. Link the Source to the new Node's input.
3. Link the new Node's output to the original Target.
**Safety**: This ignores `InputNodes` and respects port occupancy (won't connect if the port is already full).

### 6. The Knife Tool (Visual Severing)
**Problem:** Deleting multiple wires manually is slow.
**The Fix (`useEye.ts` + `useHand.ts`):**
Using `Ctrl + Right Click Drag`, the user creates a path. `useEye` performs a collision check between this path and all edges. Any intersected edges are passed to `useHand.sever()`, which removes them from the graph in a single atomic operation.

### 7. Logical Bypass (Mute Lines)
**Problem:** Muting a node should pass the input directly to the output without processing.
**The Fix (`Brain.ts` + `CustomEdge.tsx`):**
- **Logic**: `Brain.ts` detects the `muted` flag. If true, it recursively calls `pullValue` on a predefined "Bypass Handle" (e.g., `inputA`) and returns that value directly.
- **Visual**: `CustomEdge.tsx` detects if the source node is muted. If so, it renders a specialized "Bypass Line" (Purple dashed) that visually bypasses the node's shell to indicate the flow of data is jumping through.

---

## 🏛️ Structural Blueprint
(Structure moved to [.agent/blueprints.md](file:///.agent/blueprints.md))

---

## 🏗️ Strategic Debt & Architectural Boundaries

As of Jan 2026, Calctopus intentionally maintains certain architectural debts to prioritize logic-speed and implementation simplicity.

### 1. The Synchronicity Boundary (The "Static" Engine)
**Constraint:** `pullValue` and `evaluate` are strictly **Synchronous**.
- **The Debt:** We cannot currently implement "Network Nodes" (e.g., Real-time Exchange Rates, API calls) because the recursive pull link would break at any `await`.
- **Strategy:** Calctopus is positioned as a **Pure Logic Generator**. If async is needed in the future, the engine must be refactored to use `Async/Await` Generators or a `Promise-based` Pull, which will significantly increase complexity.

### 2. Computed State Persistence (The "Pop-in" Effect)
**Constraint:** Only structural configuration (nodes, edges, literal values) is persisted to `localStorage`.
- **The Debt:** On page reload, intermediate calculation results are NOT restored. 
- **The Mitigation:** We force a `logicVersion` update immediately after load (`mouth.eat()`) to ensure the graph evaluates instantly, though there may be a frame of "zeroed" results.

### 3. Type Hubris (Defensive Casting)
**Constraint:** JavaScript's weak typing ("100" + 5 = "1005") is a risk for mathematical software.
- **The Fix:** The engine enforces strict numeric casting (coercion) within `Brain.ts` for all Input data (e.g., `Number(val) || 0`) before it touches MathJS.

### 4. Visual Scalability (Graph Layout)
**Constraint:** Complex graphs with 50+ nodes lead to cognitive overload and spaghetti connections.
- **The Solution:** Auto Layout via **Elk.js** (`Shift + L`) allows users to instantly organize their graph into a readable hierarchical structure.
- **Next Steps:** Implementing "Sub-graphs" (Grouping) to further collapse complexity.

### 5. Mute System Sync (The "Double Map" Debt)
**Constraint:** Mute bypass logic is currently duplicated between the engine and the UI.
- **The Debt**: Both `Brain.ts` and `CustomEdge.tsx` maintain a manual mapping of "Primary Bypass Handles". Adding a new node type requires updating both files.
- **Risk**: A desync could show a visual bypass line while the engine still processes logic (or vice versa).
