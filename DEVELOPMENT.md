# 🧙 Calctopus Development Guide & Black Magic

This document details the internal architecture, hidden logic ("Black Magic"), and specific implementation details that maintain the stability of Calctopus. Read this before refactoring core components.

## 🧠 Core Architecture: The Hybrid Pull Model

Calctopus uses a **Decoupled Reactive Loop** to ensure that complex mathematical calculations never lag the user interface.

### 1. The Nervous System (`src/nerves/`)
The Body and Brain communicate via specialized hooks. **Crucial:** All these hooks must return memoized objects to prevent React re-render cascades.

-   **`useHand` (Motor Nerve):** Manages user interactions like grabbing, copying, pasting, and duplicating nodes.
-   **`useEar` (Sensory Nerve):** Listens for global keyboard shortcuts and mouse movements.
-   **`useEye` (Sensory Nerve):** Manages vision and viewport (Focus, Zoom, Pan).
-   **`useMemory` (Hippocampus):** Provides short-term memory (Undo/Redo) capabilities.
-   **`useMouth` (Communication Nerve):** Handles long-term persistence (Auto-save) and file IO.

### 2. The Cycle of Reactivity (V3: Decoupled)
1.  **Visual Change (Drag/Select):** Handled entirely by React Flow and local state. No calculation is triggered.
2.  **Logical Change (Type/Connect):** Any data-altering action calls `triggerLogicUpdate()`.
3.  **The Signal:** The global `logicVersion` (Zustand) increments.
4.  **The Pull:** Functional nodes (like `NodeOutput`) detect the version change and initiate a **Lazy Pull**.
5.  **Recursion:** `Brain.ts` runs `pullValue()`, which recursively traverses the graph *backwards* from the output to the source.
6.  **Expression:** Results are displayed instantly. Because this is decoupled from the drag loops, dragging remains 60fps.

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

---

## 🏛️ Architecture Snapshot (Updates)

### 1. High-Level Stack
-   **Framework:** Next.js 16 (App Router)
-   **UI Library:** React 19
-   **State Management:** Zustand (`useAppStore.ts`) for global signals.
-   **Graph Engine:** `@xyflow/react` (React Flow 12)
-   **Math Engine:** `mathjs`

### 2. Key Directories
-   `src/nerves/`: Stabilized hooks for logic-to-UI communication.

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

### 4. Visual Scalability (Spaghetti UX)
**Constraint:** Complex graphs with 50+ nodes lead to cognitive overload.
- **The Strategy:** High-level grouping (Sub-graphs) and "Defined Variabled Naming" for intermediate Math nodes are the next strategic milestones to prevent "Visual Spaghetti."
