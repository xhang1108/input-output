# 🐙 Calctopus

**Calctopus** is a high-performance, node-based visual calculator designed for complex calculation workflows. Built with a robust **React/Next.js** architecture using **React Flow**, Calctopus provides a seamless and intuitive way to design, visualize, and execute mathematical logic.

## ✨ Key Features

- **Node-Based Interface:** Design calculations visually by connecting nodes.
- **Fine-Grained Reactivity:** Experience instant updates across the entire graph as you change inputs.
- **Specialized Node Types:**
  - **Input Nodes:** Provide raw values or variables.
  - **Math Nodes:** Perform Arithmetic operations (Add, Sub, Mul, Div).
  - **Unary Nodes:** Handle single-input operations (e.g., Negate).
  - **Output Nodes:** Visualize results with real-time tracking.
- **Premium UI:** A sleek, dark-themed interface optimized for both desktop and mobile.
- **Mobile Optimizations:** Built-in virtual keyboard avoidance and touch-friendly controls.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Graph Engine:** [@xyflow/react](https://reactflow.dev/) (React Flow)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **State Management:** React-based dependency tracking for the calculation engine.

## 🔄 System Architecture & Data Flow

Understanding how the components interact ("The Cycle of Life"):

1.  **User Action**: The user provides input via Keyboard or Mouse.
2.  **Sensory Input** (`useEar`): 
    -   The **Ear** hears the input (e.g., `Ctrl+V`) and signals the **Hand** to act.
3.  **Motor Response** (`useHand`):
    -   `useHand` executes the command (e.g., calculates paste physics) and updates the **Body's** state.
4.  **Sensory Input** (`useBrain`):
    -   The `useBrain` hook observes changes in the **Body**.
    -   The `useBrain` hook observes changes in the **Body**.
    -   It generates a "fingerprint" of the graph's logic (ignoring visual changes like simple dragging) to prevent unnecessary thinking.
4.  **Cognition** (`Brain.ts`):
    -   If the logic changed, the **Brain** performs a Topological Sort and calculates values for every node.
    -   It returns a `Thoughts` object containing results and ASTs.
5.  **Expression** (`useSpeech`):
    -   The **Body** receives the thoughts.
    -   `useSpeech` translates the raw AST into human-readable formulas (e.g., on Output nodes).
6.  **Visual Update**: The **Body** updates the React components to show the new results (Green) or errors (Red).

---


Calctopus adopts a unique "Body Metaphor" for its codebase naming convention, making the system architecture intuitive and human-centric:

- **🧠 Brain** (`src/engine/Brain.ts`): The core computational engine. It "thinks" by processing the graph topology and performing calculations.
- **⚡ Nerves** (`src/nerves/`): Custom hooks that connect the Brain to the Body.
  - **`useBrain` (Sensory Nerve):** Listens to changes in the graph and triggers the Brain to think.
  - **`useHand` (Motor Nerve):** Manages user interactions like grabbing, copying, pasting, and duplicating nodes.
  - **`useEar` (Sensory Nerve):** Listens for global keyboard shortcuts (e.g., `Ctrl+C`, `Shift+A`) and mouse movements.
  - **`useEye` (Sensory Nerve):** Manages vision and viewport (Focus, Zoom, Pan).
  - **`useMemory` (Hippocampus):** Provides short-term memory (Undo/Redo) capabilities.
  - **`useMouth` (Communication Nerve):** Handles long-term persistence (Auto-save) and file IO (Import/Export).
  - **`useSpeech` (Language Nerve):** Translates the abstract mathematical logic (AST) into human-readable formulas (e.g., converting a tree of nodes into "sin(x) + 5").
- **🧍 Body** (`src/components/Body.tsx`): The main visual interface (formerly GraphEditor). It is the physical manifestation of the calculator that the user interacts with.
- **🎨 Skin** (`src/components/Skin.tsx`): The UI overlay layer that handles buttons, tooltips, and non-graph interactions.
- **👻 Soul** (`src/components/Soul.tsx`): The application wrapper that provides context and life to the app (Providers).

## 🧩 Atomic Design Philosophy (The RISC Metaphor)

This project follows a strict separation between **Atomic Instructions** and **Macro Triggers**, similar to a RISC (Reduced Instruction Set Computer) architecture:

1.  **Organs as Atoms (RISC)**
    -   Modules like `useHand` provide the smallest possible units of action (e.g., `grab`, `paste`, `delete`).
    -   These functions are **pure logic** and state management. They do not care *how* they are triggered.

2.  **Inputs as Macros (Scripts)**
    -   Modules like `useEar` (Keyboard) and `Skin` (UI) act as scripts.
    -   They contain **NO logic**. Their only job is to bind a user event (e.g., `Ctrl+C`) to an organ's instruction (e.g., `hand.copy()`).

**Why?** This decoupling allows us to change the interface (Skin) or controls (Ear) without ever risking breaking the core business logic (Organs).

### Code Structure Guidelines
To maintain this philosophy, `src/nerves/useHand.ts` and `src/utils/graphPhysics.ts` are structured as follows:

### Level 1: Pure Atoms (`src/utils/graphPhysics.ts`)
- **What:** Pure functions with **NO** dependencies on React or application state.
- **Role:** The "Laws of Physics" for the graph.
- **Examples:** `getBoundingBox` (calculates geometry), `generateOffsetNodes` (math for movement), `createNodeObject` (data structure generation).

### Level 2: State Atoms (`src/nerves/useHand.ts`)
- **What:** Internal helper functions that manage state updates.
- **Role:** The "Muscle Memory".
- **Examples:** `_spawnNodes` (standardized way to add nodes), `_removeNodes` (safe deletion of nodes/edges).

### Level 3: Compound Actions (The Hands)
- **What:** Public-facing methods that compose Physics (L1) and State (L2) atoms.
- **Role:** The "Conscious Actions" exposed to the UI.
- **Examples:**
  - `paste()`: Calls L1 `getBoundingBox` -> L1 `generateOffsetNodes` -> L2 `_spawnNodes`.
  - `duplicate()`: Reuses exact same logic chain as `paste()` to ensure consistency.

## 🧹 Clean Debugging Standard

To maintain the architectural integrity of Calctopus, we follow a strict **Cleanup-After-Debug** protocol:

1.  **Experimental Code Removal**: Once the root cause of a bug is identified and a final solution is implemented (e.g., a CSS fix), all intermediate experimental code (e.g., failed state-reset strategies, temporary console logs, or unused debug helpers) **must be removed**.
2.  **Audit the investigation**: Before considering a task complete, audit every line of code added during the search for the fix. If a change does not directly contribute to the final solution or provide mission-critical defense, it is considered "useless code" and should be deleted to prevent technical debt.
3.  **No Dead Hooks**: Ensure that any debug hooks or helper variables (like `window.calctopus`) are stripped from production-ready code.


## 🚀 Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🔮 Future Roadmap

- [ ] **Advanced Math:** Support for trigonometry, powers, and roots.
- [ ] **Logic Gates:** Integration of `if/else` and comparison operators.
- [ ] **Persistence:** Local storage auto-save and cloud sync.
- [ ] **Export Options:** Save your graphs as high-resolution images.

---
Built with ❤️ by the Calctopus Team.
