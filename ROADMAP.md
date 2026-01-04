# 🗺️ Calctopus Roadmap

This roadmap outlines the past achievements and future ambitions for **Calctopus**, the high-performance node-based calculator.

## ✅ Phase 1: Foundation (Completed)
**Goal:** Establish a robust React/Next.js architecture with specific "Black Magic" stability features.

- [x] **Core Architecture**
    - [x] Migration from SvelteKit to **Next.js 14+**.
    - [x] Integration of **React Flow** for the graph engine.
    - [x] **"Brain-Body" Separation:** Decoupled calculation logic (`Brain.ts`) from rendering (`Body.tsx`).
- [x] **Basic Node System**
    - [x] **Math Nodes:** Add, Subtract, Multiply, Divide.
    - [x] **Input/Output:** Raw inputs and real-time result visualization.
    - [x] **Unary Ops:** Negation.
- [x] **Interactions & UX**
    - [x] **Blender-style Detachment:** Drag from input to disconnect/reconnect.
    - [x] **Mobile Optimization:** Touch controls and virtual keyboard avoidance.
    - [x] **Toast Notifications:** Integration with `sonner`.
- [x] **Persistence ("The Mouth")**
    - [x] **Auto-Save:** Robust LocalStorage synchronization.
    - [x] **Import/Export:** JSON file support.

---

## 🚧 Phase 2: Logic & Control (Current Focus)
**Goal:** Transform Calctopus from a calculator into a visual programming language.

- [ ] **Comparison Nodes**
    - [ ] Greater Than (`>`), Less Than (`<`).
    - [ ] Equals (`=`), Not Equals (`!=`).
    - [ ] Greater/Less or Equal (`>=`, `<=`).
- [ ] **Boolean Logic**
    - [ ] `AND`, `OR`, `NOT`, `XOR` gates.
    - [ ] Boolean Input Node (Checkbox/Switch).
- [ ] **Control Flow**
    - [ ] **If/Else Node:** Routes values based on a boolean input.
    - [ ] **Switch Node:** Selects one of specific inputs based on an index.
    - [ ] **Clamp/Min/Max:** Restrict values to ranges.
- [ ] **Sequential Logic (Memory)** (Requires Engine Upgrade)
    - [ ] **Feedback Loops:** Allow connections to cycle back (A -> B -> A).
    - [ ] **Delay Node / Register:** Holds a value from the "previous frame" to prevent infinite recursion.
    - [ ] **Flip-Flops / Latches:** Standard memory units.

## 🎨 Phase 3: Visuals & Polish
**Goal:** Enhance the user interface and provide better tools for managing large graphs.

- [ ] **Export & Sharing**
    - [ ] **Export as Image:** Download graph as high-res PNG/SVG (Snapshot).
    - [ ] **Clipboard Image:** "Copy Image" button.
- [ ] **Navigation Aids**
    - [ ] **Minimap:** Small overview map for large graphs.
    - [ ] **Auto-Layout:** Button to automatically organize nodes nicely (using `dagre` or `elk`).
- [ ] **Customization**
    - [ ] **Background Patterns:** Toggle between Dots, Lines, Crosses.
    - [ ] **Theme Accents:** Allow changing the primary "glow" color.
- [ ] **Organization**
    - [ ] **Grouping:** Frame/Group nodes together with a label.
    - [ ] **Comments:** Sticky notes to annotate parts of the graph.

## 🧮 Phase 4: Advanced Mathematics
**Goal:** Support engineering and scientific workflows.

- [ ] **Scientific Functions**
    - [ ] Trigonometry: `sin`, `cos`, `tan` (and their arc variants).
    - [ ] Exponential: `Power (x^y)`, `Root`, `Log`, `Ln`.
    - [ ] Constants: `π`, `e`, `φ`.
- [ ] **Utilities**
    - [ ] **Random Number:** Generate random values (with seed option).
    - [ ] **Round/Floor/Ceil:** Precision controls.
    - [ ] **Modulo:** Remainder calculation.

## 📊 Phase 5: Data Structures (The "Spreadsheet" Upgrade)
**Goal:** Move beyond single scalars to handle collections of data.

- [ ] **Array Support**
    - [ ] **Array Input:** Enter `[1, 2, 3]`.
    - [ ] **Aggregators:** `Sum`, `Average`, `Median` of an array.
    - [ ] **Array Math:** Add scalar to array, or add two arrays.
- [ ] **Matrix Operations**
    - [ ] Dot Product, Cross Product.
    - [ ] Transpose, Invert.

## ☁️ Phase 6: Cloud & Collaboration (Long Term)
**Goal:** Enable sharing and persistent online storage.

- [ ] **Shareable Links:** Generate a read-only URL for a graph.
- [ ] **User Accounts:** Save graphs to the cloud (Supabase/Firebase).
- [ ] **Templates:** Community gallery of useful calculators.
