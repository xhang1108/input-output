# 🗺️ Calctopus Roadmap

> **Mission:** Build a life-optimization calculator using Blender-style node workflow, strict atomic design, and vectorization-first computation.

> [!TIP]
> **[MATH_HIERARCHY.md](file:///d:/Antigravity/Calctopus/MATH_HIERARCHY.md)**: 15-Level Math Complexity Guide  
> **[UTILITY_NODES.md](file:///d:/Antigravity/Calctopus/UTILITY_NODES.md)**: Helper Nodes Specification  
> **[RULES.md](file:///d:/Antigravity/Calctopus/.agent/RULES.md)**: Architectural Constraints

---

## 🛑 Phase 0: Strategic Realignment (CURRENT PRIORITY)
**Goal:** Build a flexible system that can be simple for beginners but highly complex for experts. Fix the foundation before moving forward.

- [x] **1. Future Alignment**
    - [x] Defined goal: "Life Optimization" not just "Math Research".
    - [x] Updated Roadmap to include Phase 17 (Real-World Solvers).
- [x] **2. Rules & Skills**
    - [x] Created `RULES.md` (Constraints).
    - [x] Created `SKILL_ATOMIC_DESIGN.md` (Design Methodology).
- [ ] **3. Engine Architecture Review (The "Pulse" Question)**
    - [ ] **Status:** **Pending Discussion**. Needs a final verdict on Pull vs Push vs Hybrid and future support for Loops/Optimization.
- [ ] **4. Interaction UX Overhaul (The "Feel")**
    - [ ] **Issue:** "Dislike React Flow's default connection behavior."
    - [ ] **Goal:** Define custom connection logic (Blender-style? MagSafe? Proximity?).
    - [ ] **Action:** Plan a complete rewrite of `onConnect` / `onEdgeUpdate` logic to match user intuition.
    - [ ] **Decision:** **100% Blender Parity**. Mimic Blender's socket magnetism, hotkeys (Shift+A, X), and feel.
- [ ] **5. Hard Rules Definition**
    - [ ] Enforce "No Magic Nodes" in code reviews.
    - [ ] Strict Atomic Units policy.
    - [ ] **Global Variables (The Context):** **Strict Wiring** first. Every variable must have a visible wire. No hidden magic. "Drivers/Attributes" recorded as future enhancement.
- [ ] **6. Execution Sequence**
    - [ ] Re-plan L0-L15 implementation order based on new atomic rules.

### 🔗 Backend Comparison (Phase 18 Cloud Storage)
| Provider | Storage | Daily Writes | Daily Reads | Bandwidth | Free Users |
|----------|---------|--------------|-------------|-----------|------------|
| **Cloudflare D1** | 5GB | 1,000 | 100,000 | Unlimited | ~100 active |
| **Supabase** | 500MB | Unlimited | Unlimited | 5GB/month | ~833 active |
| **Decision** | Start with Cloudflare D1 (fully free), migrate to Supabase if write limit hit |

---

## ✅ Phase 1: Foundation (Completed)
**Goal:** Establish a robust Next.js/React Flow architecture.

- [x] **Core Architecture**
    - [x] Next.js 14+ / React Flow Integration.
    - [x] **Separation of Concerns:** `Brain.ts` (Pure Logic) vs `Body.tsx` (React Render).
- [x] **Interaction Model**
    - [x] **Blender Detachment:** `onReconnect` logic for dragging input edges.
    - [x] **Nerves System:** Custom hooks (`useBrain`, `useHand`, `useEar`) for event handling.
- [x] **Persistence (The Memory)**
    - [x] `localStorage` sync via `useMouth`.
    - [x] **Decision:** **No Stale Cache**. Recalculate on load to ensure accuracy.
- [x] **Performance & Optimization**
    - [x] **Engine Debounce:** Optimize `useBrain` to skip hash calculation during drag frames.
    - [x] **Edge Rendering:** Refactor `CustomEdge` to use `edge.data.isFormula` instead of expensive `getNode()` lookups for styling.
    - [x] **Frame Cache:** Implement memoization in `Brain.ts` for recursive evaluation.
- [ ] **Onboarding (The Start)**
    - [ ] **Decision:** **"Default Cube"**. Load a simple, working graph (Input->Math->Output) by default. No complex gallery yet.
- [ ] **Undo Scope (The Time Machine)**
    - [ ] **Decision:** **Full State (Blender Style)**. Undo tracks both structure changes AND value changes.
    - [ ] *Note:* Blender performs a full state snapshot. We will aim for this despite higher memory cost.
- [ ] **Error Recovery (The Safety Net)**
    - [ ] **Decision:** **Auto-Save**. Save to `localStorage` every 30 seconds.

---

## 📚 Math Libraries Architecture
**Current Stack:** Three-Engine System for Optimal Performance

### ✅ Active Libraries
- **Nerdamer** (~100KB)
  - Purpose: Equation solving (single & systems), basic symbolic operations
  - Key Feature: `solveEquations()` for automatic system solving
  - Limitation: Algebra/Calculus modules need proper loading
  
- **Algebrite** (~300KB)
  - Purpose: Advanced symbolic operations (factoring, calculus)
  - Key Feature: All functions built-in, no module loading required
  - Use Case: Fills gaps where Nerdamer modules fail
  
- **MathJS** (~200KB)
  - Purpose: Numerical computation, matrix operations, unit conversion
  - Key Feature: Fast numerical evaluation, comprehensive math functions
  - Use Case: All non-symbolic calculations

### 📋 Implementation TODO List

#### 🔧 Module Loading & Routing (High Priority)
- [ ] **Fix Nerdamer Module Loading**
  - [ ] Investigate why `Algebra` and `Calculus` modules not loading
  - [ ] Test `factor()`, `diff()`, `integrate()` functions
  - [ ] Document correct module loading pattern
  
- [ ] **Create Math Router System**
  - [ ] Create `src/lib/mathEngine.js` - Lazy loading manager
  - [ ] Create `src/lib/mathRouter.js` - Decision routing logic
  - [ ] Implement dynamic imports for all three libraries
  - [ ] Add error fallback mechanisms

#### 🎨 Unary Node Enhancements
- [ ] **Add Symbolic Operations to Unary Node**
  - [ ] Extend operations list with:
    - [ ] `factor` - Factor expressions (Algebrite)
    - [ ] `expand` - Expand expressions (Nerdamer)
    - [ ] `simplify` - Simplify expressions (Nerdamer)
    - [ ] `diff` - Differentiate (Algebrite)
    - [ ] `integrate` - Integrate (Algebrite)
  - [ ] Update `NodeUnary.tsx` operations array
  - [ ] Implement routing logic in `Brain.ts`

#### 🧮 Solver Node Intelligence
- [ ] **Enhance Solver Auto-Detection**
  - [ ] Implement equation count detection
  - [ ] Add variable extraction logic
  - [ ] Route single equations to `Nerdamer.solve()`
  - [ ] Route systems to `Nerdamer.solveEquations()`
  - [ ] Add symbolic operation detection (no `=` sign)
  
- [ ] **Improve Solver Capabilities**
  - [ ] Test `solveEquations()` with 2+ variables
  - [ ] Add support for non-linear systems
  - [ ] Implement automatic factoring before solving

#### ⚡ Performance Optimization
- [ ] **Implement Lazy Loading**
  - [ ] Convert all math library imports to dynamic imports
  - [ ] Add loading state management
  - [ ] Implement library caching
  - [ ] Measure bundle size reduction
  
- [ ] **Smart Preloading**
  - [ ] Preload Nerdamer on app start (most common)
  - [ ] Lazy load Algebrite and MathJS on first use
  - [ ] Add loading indicators for first-time operations

### 🎯 Division of Labor
```
User Input
    ↓
┌─────────────┬──────────────┬─────────────┐
│  Nerdamer   │  Algebrite   │   MathJS    │
├─────────────┼──────────────┼─────────────┤
│ • Equations │ • Factoring  │ • Numerical │
│ • Systems   │ • Calculus   │ • Matrices  │
│ • Expand    │ • Integrate  │ • Units     │
│ • Simplify  │ • Derive     │ • Evaluate  │
└─────────────┴──────────────┴─────────────┘
```

---

## ✅ Phase 2: Hybrid Pull Architecture (Completed)
**Goal:** Implementation of "Push Signal, Pull Data" Engine.

> **Hypothesis (LaTeX Chain):** Can links form a "LaTeX Chain" where the graph just builds a formula string, and we execute the string? Status: Needs Verification. This might simplify complex math but complicate dynamic logic.

- [x] **Core Engine Rewrite**
    - [x] **PullEngine.ts:** Implement recursive `pullValue` with cycle detection in `Brain.ts`.
    - [x] **Payload Standard:** Define `NodePayload` structure.
    - [x] **Safety:** Implement `FALLBACK_PAYLOAD` and error handling.
    - [x] **Decision:** **Hybrid Pull**. Nodes only calculate when "pulled" by a Result/Monitor node.
- [x] **Node Architecture v2**
    - [x] **Smart Result Node:** Logic nodes trigger calculation via `pullValue`.
    - [x] **Lazy Intermediates:** Nodes only calculate when pulled (Dead Code Elimination / Lazy Evaluation).
    - [x] **Scoped Flow:** Wires carry variable tables (`scope`) for formula generation.
- [x] **Migration**
    - [x] Deprecate `Brain.think()` (Monolithic Push).
    - [x] Verify `ResultNode` handles Cycles gracefully without crashing.
- [x] **Null State (The Void)**
    - [x] **Decision:** **Strict Error Reporting**. No silent failures. Control everything.
- [x] **Error Propagation (The Virus)**
    - [x] **Decision:** **Containment**. Error stops at the source node (Red). Downstream nodes become "Waiting/Gray", avoiding a cascade of red.
- [x] **Logic Nodes Implementation**
    - [ ] **Note:** Logic nodes are being expanded based on the **[MATH_HIERARCHY.md](file:///d:/Antigravity/Calctopus/MATH_HIERARCHY.md)** levels.
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

## ✅ Phase 3: Visuals & Polish (Completed)
**Goal:** Enhance the user interface and graph management tools.

- [x] **Sticky Placement (Blender Style)**
    - [x] **Shift+D**: Implemented spawn-in-place + relative sticky movement.
    - [x] **Ctrl+V**: Standard mouse-centered paste (non-sticky).
    - [x] **Race Condition Fix**: Ensured 100% activation reliability by passing node refs directly.
- [x] **Keyboard Shortcuts Audit:**
    - [x] 1. Verify operation of all existing shortcuts.
    - [x] 2. Implement new shortcuts for improved workflow (Fit View, Focus).
    - [x] 3. **Copy-Paste with Edges**: Ensure connected edges are also copied when multiple nodes are selected and pasted.
    - [x] **Hotkey Conflicts (The Shortcuts):** **Blender Priority**. Handle browser conflicts (Ctrl+W) on case-by-case basis.
- [x] **Graph Layout Engine**
    - [x] **Library:** Integrated `elkjs` via `useLayout` hook.
    - [x] **Strategy:** Used `elk.layered` algorithm respecting ports.
    - [x] **UI:** Added "Layout" button in the Panel.
- [x] **Navigation & A11y**
    - [x] **Minimap:** Added `<Minimap />` with custom node colors.
    - [x] **Keyboard:** Ensure `useEar` handles Focus Management.
    - [x] **Zoom Behavior (The Lens):** **Zoom to Mouse**. Canvas zooms centered on cursor position (Blender/Figma style).
- [x] **Search Semantics (The Key)**
    - [x] **Decision:** **Hybrid Search**. Support both English ("Add") and Math Symbols ("+") in the search bar.
- [ ] **Animation System (The Motion)**
    - [ ] **Decision:** **Configurable (React Flow Defaults)**. Use framework-provided animations with optional "Reduce Motion" setting.

---

## 🚧 Phase 4: Socket Shape Validation (CURRENT FOCUS)
**Goal:** Implement Socket Geometry Repel (Visual Validation).

- [ ] **Socket Sizing & Geometry**
  - [ ] Shapes are **Pending Discussion**. (Explore Blender-style vs unique Calctopus shapes).
- [ ] **Type Strictness (The Law) - Layered Validation**
  - [ ] Layer 1: **Repel** invalid connections (Matrix -> Bool).
  - [ ] Layer 2: **Dashed Line** for auto-conversions (Number -> String).
      - [ ] Render edge as dashed when Number → String happens
  - [ ] Layer 3: **Runtime Error** for value issues.
- [ ] **Connection Repel Logic**
  - [ ] **Strict Validation**: Prevent incompatible connections (e.g., Matrix → Scalar) from snapping.
  - [ ] Show "incompatible" cursor or visual feedback during drag.
- [ ] **Multiple Output Sockets (The Split)**
  - [ ] Support nodes with >1 output.
  - [ ] **Decision:** **Multiple Handles (Blender Style)**. Use separate output sockets. Require explicit `Separate` node to unpack composite data.

---

## 🧮 Phase 4b: Advanced Mathematics
**Goal:** Support engineering workflows.

- [x] **Scientific Functions**
    - [x] **Library:** Leveraged `mathjs`.
    - [x] **Node:** Expanded `NodeUnary.tsx` to include `sin`, `cos`, `tan`, `log`, etc.
    - [x] **UI:** Added a dropdown to select functions.
- [ ] **Custom Functions (Subgraphs)**
    - [ ] **Architecture:** Define a `MacroNode` type that holds a nested `nodes` and `edges` state.
    - [ ] **Execution:** `Brain.ts` needs to recursively call a `pullValue` sub-routine for these nodes.

---

## 🧪 Phase 5: Atomic Units System
**Goal:** Implement No Magic Units (Node Granularity).

- [ ] **Node Granularity (The Atom)**
    - [ ] **Decision:** Atomic Composition for logic, but use **Libraries (MathJS)** for heavy lifting (Matrices).
- [ ] **Dedicated Unit Node**
  - [ ] Create a standalone `Unit` node.
  - [ ] **Allowed Units**: km, L, $, h, kg, m, s (Fundamental only).
  - [ ] Attach to inputs/outputs to tag data with units.
- [ ] **Zero Overhead for Pure Numbers**
  - [ ] Default unit = `null`
  - [ ] No performance penalty for unitless calculations

---

## 📊 Phase 5b: Data Structures [P0 - Immediate]
**Goal:** Handle collections of data (Arrays/Matrices).

- [ ] **Matrix Engine Support**
    - [x] **MathJS:** Switch internal operations from native JS (`a + b`) to `math.add(a, b)` to support matrix addition automatically.
    - [ ] **Type Guard:** Update `CustomEdge.tsx` to detect `Array` values (Visual feedback strategy TBD).
    - [ ] **Advanced Operators:** Add support for high-level matrix functions:
        - [ ] `transpose(A)` / `A^T`
        - [ ] `det(A)` (Determinant)
        - [ ] `inv(A)` (Inverse)
        - [ ] `tr(A)` (Trace)
        - [ ] `A .* B` (Element-wise multiplication)
    - [ ] **Validation Logic:** Implement dimension checking based on [matrix-operation-rules.md](file:///C:/Users/Jayden/.gemini/antigravity/brain/f7a9799c-2eec-47e4-a517-e62f58150cc6/matrix-operation-rules.md).
- [ ] **UI Visualization**
    - [ ] **Output Node:** If `value` is Array, render a small HTML `<table>` or grid instead of a single number.
    - [ ] **Spreadsheet Node:** A new input node allowing CSV-style data entry.
    - [ ] **Dimension Badges:** Display matrix size (e.g., `[5x5]`) on wires and node headers.
    - [ ] **Matrix Preview (Node Preview):** Implement a "Quick Look" feature to preview larger matrices in a popover. Current matrix display is sufficient; no tooltip overlay needed.

---

## 📦 Phase 6: Deployment & Infrastructure
**Goal:** Production readiness and public access.

- [ ] **Platform Priority (The Device)**
    - [ ] **Decision:** **Desktop Web First**. Mobile layout strictly secondary for now.
- [ ] **Domain Configuration**
    - [ ] **Prefix Change:** Update project configuration to use new domain prefix.
- [ ] **Cloudflare Pages**
    - [ ] **Integration:** Connect repository to Cloudflare Pages for continuous deployment.
    - [ ] **Environment:** Configure build settings for Next.js static/edge export.

---

## 🛠️ Phase 7: Engineering Health
**Goal:** Maintain stability at scale.

- [ ] **Execution Speed (The Throttle)**
    - [ ] **Decision:** **Auto/Pause/Play**. Start with Auto. User can Pause for heavy graphs.
- [ ] **Testing Strategy**
    - [ ] **Unit:** Add `vitest` to test `Brain.pullValue()` with various graph topologies (Cyclic, Disconnected, Type Errors).
    - [ ] **E2E:** Browser-based tests (utilizing Chrome DevTools Protocol) to verify "Drag from Handle" works on canvas.
- [ ] **Performance (Web Workers)**
    - [ ] **Refactor:** Move `Brain.ts` into a `brain.worker.ts`.
    - [ ] **Comms:** Use `postMessage` to send `nodes/edges` and receive `results`, keeping the UI thread unblocked.

---

## ☁️ Phase 8: Cloud & Community
**Goal:** Sharing and Storage.

- [ ] **Save Format (The Persistence)**
    - [ ] **Goal:** LaTeX-based format preferred. Needs feasibility testing.
- [ ] **Serialization**
    - [ ] **Compression:** Use `lz-string` to compress the JSON graph before encoding into the URL hash for easy sharing.
    - [ ] **Cloudflare D1:** Use Cloudflare D1 (SQLite) as the primary database for saving and sharing user graphs.

---

## 🔮 Phase 9: Symbolic & Constraint Intelligence
**Goal:** Transform Calctopus from a Calculator to a Computational Engine.

- [ ] **Omni-directional Nodes (Constraint Solver)**
    - [ ] **Current State:** Solver uses Nerdamer for single-variable solving. User must manually specify target variable. Unidirectional only.
    - [ ] **Concept:** Nodes with no fixed inputs/outputs. Ports adapt based on data flow.
    - [ ] **Implementation:** Input `PV = nRT`. The node exposes 5 ports. Connect any 4 variables, and the 5th becomes the output.
    - [ ] **Auto-detection:** Automatically detect which variables are known (connected inputs) vs. unknown (unconnected ports).
    - [ ] **Dynamic Solving:** Real-time re-balancing of the equation tree based on what is known vs. unknown.
    - [ ] **Multi-equation Systems:** Support simultaneous equations with multiple unknowns (e.g., `2x+y=10`, `x-y=2` → solve for both x and y).
    - [ ] **Constraint Propagation:** When one variable changes, automatically re-solve dependent equations in the graph.
- [ ] **Symbolic Data Flow**
    - [ ] **Expression Propagation:** Wire carries `Symbol("x")` or `Expression("sin(x^2)")` instead of just numbers.
    - [ ] **Computer Algebra System (CAS):** Nodes calculate symbolic derivatives, integrals, or simplifications.
    - [ ] **Visual Proofs:** Show the step-by-step transformation of a formula as it passes through the graph.

---

## 🧬 Phase 10: Simulation & Macros (Blender 5.0 Architecture)
**Goal:** Introduce programmability, loops, and time-based simulation.

- [ ] **Cyclic Logic (The Loop)**
    - [ ] **User Insight:** "Compound interest is just a formula, why loop?"
    - [ ] **Decision:** **Vectorization (Array Ops)**. Use `Range(0..80)` -> `Map` instead of `For Loop` nodes.
- [ ] **Simulation Zones (Time Travel)**
    - [ ] **Concept:** Allow `Result(Frame t)` to be fed into `Input(Frame t+1)`.
    - [ ] **Architecture:** Implement a **Simulation Zone** (Input/Output pair). Nodes inside execute once per frame.
    - [ ] **State Cache:** Need a "Cache Manager" in `Body.tsx` to store the history of simulation steps.
- [ ] **Smart Groups (Optimized Logic) / Grouping Strategy (The Org)**
    - [x] **Core:** Recursive engine support (`Brain.ts`).
    - [ ] **Decision:** **Blender-style Node Groups**. (Enter/Exit groups), not tabs.
    - [ ] **Large Graph Handling (The Performance):** **Group-as-LaTeX Compilation**. Encourage users to use Groups for performance. Collapsed groups compile to single LaTeX formula.
    - [ ] **LaTeX Compilation:** When a group is collapsed, compile the entire subgraph into a single LaTeX formula.
    - [ ] **Symbolic Algebra:** Use symbolic computation to simplify the grouped nodes into an optimized algebraic expression.
    - [ ] **External Input Binding:** Detect input ports from outside the group and convert them into LaTeX variables (e.g., `a`, `b`, `c`).
    - [ ] **Performance Optimization:** Skip rendering and calculating internal nodes when the group is collapsed—only evaluate the final LaTeX formula.
    - [ ] **Dynamic Formula:** The compiled LaTeX formula accepts external data and updates in real-time when inputs change.
    - [ ] **UI:** Leverage existing `GroupNode`, display the compiled LaTeX formula on the collapsed group node.
- [ ] **Data Bundles (Structs)**
    - [ ] **Concept:** Clean up spaghetti wires by bundling related data.
    - [ ] **Implementation:** A single wire carries `{ pos: Vec3, vel: Vec3, mass: Number }`.
    - [ ] **Nodes:** `Pack Bundle` and `Unpack Bundle` nodes.

---

## 🎓 Phase 11: LaTeX-to-Node Generation [P1 - Core Logic]
**Goal:** Transform LaTeX formulas into executable nodes (subgraphs).
**Relationship to Phase 15:** While Phase 15 provides a single "Script" node for LaTeX, Phase 11 is about generating the actual visual graph/subgraph from a LaTeX string.

- [ ] **LaTeX Parser & AST**
    - [ ] **Library:** Integrate `tex-math-parser` (third-party library designed for MathJS) to parse LaTeX into MathJS expression trees.
    - [ ] **Note:** MathJS itself cannot parse LaTeX input (only outputs LaTeX via `toTex()`), so `tex-math-parser` is required as the bridge.
    - [ ] **Validation:** Ensure the parser can handle common mathematical notation (fractions, exponents, Greek letters, operators, matrices).
- [ ] **Formula-to-Node Compiler**
    - [ ] **AST → Graph:** Implement a compiler that converts LaTeX AST into a subgraph of Calctopus nodes.
    - [ ] **Example:** `\frac{a + b}{c}` → Creates Add node (a, b) → Divide node (result, c).
    - [ ] **Variable Detection:** Automatically identify variables in the formula and create input ports.
- [ ] **Node Generation UI**
    - [ ] **LaTeX Input Field:** Add a text area where users can paste LaTeX formulas.
    - [ ] **Preview:** Real-time rendering of the LaTeX formula using KaTeX or MathJax.
    - [ ] **Generate Button:** Clicking generates the corresponding node/subgraph on the canvas.
- [ ] **Standardization & Library**
    - [ ] **Formula Library:** Create a repository of common formulas (physics, engineering, finance) in LaTeX format.
    - [ ] **One-Click Import:** Users can browse and import pre-made formula nodes from the library.
    - [ ] **Export to LaTeX:** Allow users to select a subgraph and export it back to LaTeX notation.
- [ ] **Bidirectional Sync**
    - [ ] **Node → LaTeX:** When nodes are modified, update the LaTeX representation in real-time.
    - [ ] **LaTeX → Node:** When LaTeX is edited, regenerate the node graph automatically.
    - [ ] **Visual Consistency:** Ensure the node layout reflects the mathematical structure (e.g., numerator above denominator).

---

## 🛠️ Phase 12: Engineer's Toolkit [P2 - Specialized]
**Goal:** Bridge the gap between pure math and real-world engineering.

- [ ] **Unit Conversion Engine**
    - [ ] **Library:** Use MathJS unit system.
    - [ ] **Nodes:** Implement `Unit` node (Input) and `Convert` node.
    - [ ] **Features:** Support for metric/imperial, mixed units (e.g., `5ft + 2in`), and dimensional analysis validation.
- [ ] **Vector Calculus & Physics**
    - [ ] **Operators:** Add `dot(A, B)` (·) and `cross(A, B)` (×) support.
    - [ ] **Visualization:** 1D vector visualization in output nodes.
- [ ] **Physical Constants Library**
    - [ ] **Constants:** `pi`, `e`, `G` (gravity), `c` (light speed), `h` (Planck).
    - [ ] **UI:** A searchable sidebar or dropdown to quickly drop constant nodes.

---

## 📈 Phase 13: Dynamic Visualization & Plotting [P1 - Experience]
**Goal:** Transform static results into interactive visual insights.

- [ ] **Plotting Node (2D/3D)**
    - [ ] **Library:** Integrate `Recharts`, `Chart.js`, or `Plotly.js`.
    - [ ] **Data Series:** Render arrays/matrices as line charts, scatter plots, or bar graphs.
    - [ ] **Philosophy (Atomic):** Do NOT make a "Function Plotter" that takes a string formula.
    - [ ] **Implementation:** User must build the data: `Range(0..10)` -> `Map(sin)` -> `Plot(Array)`.
    - [ ] **Interactive Scrubber:** Drag a vertical line across the chart to see real-time values.
- [ ] **Graphic Output Styling**
    - [ ] **Theme Sync:** Ensure charts match Calctopus's dark/glassmorphic aesthetic.
    - [ ] **Export:** Allow users to export charts as PNG/SVG for reports.

---

## 📦 Phase 14: Structural Shells [P3 - Vision]
**Goal:** Introduce an alternative, wire-free "Algebraic Shell" interface that is interchangeable with Nodes.

- [ ] **Dual-Engine Rendering (Node vs. Box)**
    - [ ] **Architecture:** Implement a shared internal representation (AST) that can be rendered as either a React Flow graph or a nested "Box" structure.
    - [ ] **Toggling:** Add a "Switch View" button to transform the current node graph into a vertically/horizontally stacked box layout.
- [ ] **Slot-Based Interaction (The "Drop Zone")**
    - [ ] **Placeholders:** Create operators (like Division, Power) that render as visual templates with empty "Drop Zones".
    - [ ] **Drag-to-Fill:** Users can drag a value/node and "snap" it into a box's slot instead of connecting wires.
    - [ ] **Automatic Call:** Dropping a value into a numerator/denominator box automatically triggers the division logic.
- [ ] **LaTeX Triple-Sync**
    - [ ] **Workflow:** LaTeX $\leftrightarrow$ Nodes $\leftrightarrow$ Boxes.
    - [ ] **Conversion:** Ensure that a formula written in LaTeX can be instantiated as a Box-Stacking structure just as easily as a Node graph.
- [ ] **Nested Nesting (The "Matryoshka" UI)**
    - [ ] **Recursion:** Boxes inside boxes (e.g., a square root box inside a fraction box).
    - [ ] **Auto-Scaling:** UI components that dynamically resize based on the complexity of the nested content.

---

## 🚀 Phase 15: Expert Mode & Live Debugging [P0 - User Request]
**Goal:** Empower advanced users with raw power and deep introspection.

- [ ] **Expert Interface (The Layout)**
    - [ ] **Decision:** **Unified View**. No separate "Code Mode". Expert nodes (LaTeX, Script) live safely alongside visual nodes. "Don't force users to choose."
- [ ] **NodeExpression (The "One Node to Rule Them All")**
    - [ ] **Relationship to Phase 11:** Unlike Phase 11 (which builds a graph of nodes), this is a single "collapsed" node that evaluates a complex LaTeX expression internally.
    - [ ] **Concepts:** A single text-entry node that accepts complex math syntax like `\det([1,2;3,4]) * sin(x)`.
    - [ ] **Parsing:** Use `mathjs.parse()` or our existing LaTeX compiler to interact with the backend.
    - [ ] **Hybrid IO:** Automatically generate input handles based on variables detected in the expression (e.g., `a*b+c` creates inputs a, b, c).
- [ ] **Live Debugger (The "X-Ray")**
    - [ ] **Step-by-Step Execution:** Inspect the value of a formula at each operator node.
    - [ ] **Error Highlight:** specific red underlining for syntax errors or dimension mismatches (e.g., `1+ [1,2]`).
    - [ ] **Trace Logs:** A console panel showing the execution path and values `x=5 -> sin(x)=0.9 -> *2 = 1.8`.

---

## 🧱 Phase 16: Atomic Node Construction (The "LEGO" Strategy) [P0 - Architecture]
**Goal:** Build complex nodes by assembling atomic units, avoiding monolithic hard-coded logic.

- [ ] **Node Polymorphism (The Shape)**
    - [ ] **Decision:** Use **Math Libraries (MathJS/Algebrite)** for standard functions (e.g., Sigmoid, Log, Trig) whenever available.
    - [ ] **Atomic Construction:** Use atomic assembly for custom real-world logic that libraries don't provide (e.g., specialized fuel consumption logic like `100km/l`).
- [ ] **Foundation Atoms (L0-L4 Native)**
    - [ ] `Constant Node` (The Source)
    - [ ] `Math Node` (+, -, *, /)
    - [ ] `Logic Node` (AND, OR, NOT)
    - [ ] `Vector Node` (Dot, Cross)
    - [ ] **Check:** Verify these atoms pass `TEST_SUITE.md` completely.
- [ ] **Matrix Atoms (L5 Matrix)**
    - [ ] `Matrix Constructor` (Input)
    - [ ] `Matrix Op` (Add, Mul)
    - [ ] `Matrix Logic` (Det, Inv)
- [ ] **Composite Recipe Book (The "Blueprints")**
    - [ ] **Sigmoid Function:** Assemble using `1 / (1 + exp(-x))` atoms.
    - [ ] **Softmax:** Assemble using `exp(x) / sum(exp(x))` atoms.
    - [ ] **Variance:** Assemble using `Mean` -> `Square` -> `Sub` atoms.
    - [ ] **Standard Deviation:** Assemble `Variance` -> `Sqrt` atom.

---

## 🌍 Phase 17: Real-World Solvers (The "Why" Layer) [P0 - Mission]
**Goal:** Fulfill the original mission: "Optimize Life Decisions via Math".

- [ ] **Feature: NodeLabel (Renaming)**
    - [ ] **Concept:** Allow any node's header (e.g., "Input Number") to be renamed (e.g., "Price A").
    - [ ] **Implementation:** Add editable title field to `NodeHeader` component.
- [ ] **Feature: NodeTemplate (String Composition)**
    - [ ] **Concept:** A node that takes inputs `${a}`, `${b}` and a formatted string template.
    - [ ] **Example:** Input: `Buy in ${a} to save ${b}`. Result: "Buy in Taiwan to save $200".
    - [ ] **Use Case:** Generating human-readable advice from math results.
- [ ] **Feature: NodeInputUnit (Atomic Units Only)**
    - [ ] **Concept:** `InputNumber` has an **OPTIONAL** unit field (defaults to `null`).
    - [ ] **Constraint:** Only fundamental units allowed (km, L, $, h). **NO** magic compound units like `L/100km` that imply hidden math.
    - [ ] **Philosophy:** If you want `L/100km`, you must build it: `Input(8, L)` -> `Div` -> `Input(100, km)`.
    - [ ] **Zero Overhead:** Pure numbers remain simple scalars.

- [ ] **Scenario 1: Gas Station Cost-Benefit**
    - [ ] Atoms: `Input(Dist)`, `Input(Price)`, `Formula(Total)`, `Compare(Savings > TimeCost)`. 
    - [ ] *Removed Magic:* No "Optimizer" node. Use `Compare` to make the decision.
- [ ] **Scenario 2: Insurance Risk**
    - [ ] Atoms: `Input(Premium)`, `Prob(Cancer)`, `Formula(ExpectedValue)`, `Solver(EV = Cost)`.
    - [ ] *Removed Magic:* No "Intersection" node. Use `Solver` to find the break-even x.
- [ ] **Scenario 3: Cross-Border Arbitrage**
    - [ ] Atoms: `Input(Price A)`, `Input(Price B)`, `Min(A, B)`, `Switch(If A<B then "Local" else "Import")`.
    - [ ] *Removed Magic:* No "BestOption" switch. User must build the logic `If A < B`.

---

## 🔐 Phase 18: User Identity & Cloud Sync
**Goal:** Seamless experience across devices.

- [ ] **Collaboration Model (The Team)**
    - [ ] **Decision:** **Single User (Phase 1)** → **Turn-Based Cloud (Phase 18)** → **Real-Time Sync (Phase 20+)**.
- [ ] **Google OAuth 2.0 Integration**
    - [ ] **Auth:** Implement "Sign in with Google" using Supabase Auth or NextAuth.js.
    - [ ] **Profile:** Fetch user avatar and name for the UI header.
- [ ] **Cloud Persistence**
    - [ ] **Sync:** Save user graphs to the cloud automatically (no file export needed).
    - [ ] **Sharing:** Generate public read-only links for graphs.

---

## 🔮 Future Considerations (Post-Stable Release)

The following items are recorded for future development after the core product stabilizes:

- [ ] **External Data (The World):** **Manual Input First**. Fetch API/Live Data kept for future (Phase 19+).
- [ ] **Node Versioning (The Evolution):** Recorded for future. Not a concern until user base exists.
- [ ] **Telemetry (The Insight):** Future consideration. Record in backlog.
