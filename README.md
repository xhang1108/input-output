# 🧠 input-output

**input-output** is a high-performance, node-based visual calculator designed for complex calculation workflows. Built with a robust **React/Next.js** architecture using **React Flow**, input-output provides a seamless and intuitive way to design, visualize, and execute mathematical logic.

## ✨ Key Features

- **Node-Based Interface:** Design calculations visually by connecting nodes.
- **Fine-Grained Reactivity:** Experience instant updates across the entire graph as you change inputs.
- **Specialized Node Types:**
  - **Input Nodes:** Provide raw values or variables.
  - **Math Nodes:** Perform Arithmetic operations (Add, Sub, Mul, Div).
  - **Logic Nodes:** Perform boolean operations (AND, OR, XOR, NAND).
  - **Comparison Nodes:** Compare values (>, <, =, ≠) with visual LED feedback.
  - **Unary Nodes:** Handle single-input operations (e.g., Negate, Sin, Cos).
  - **Slider Nodes:** Interactive real-time value adjustment.
  - **Output Nodes:** Visualize results with real-time tracking.
- **High-Precision Engine:** Powered by `mathjs` BigNumber and frame-level caching for O(N) performance.
- **Auto-Layout:** Instant organization of complex graphs using Elk.js.
- **Premium UI:** A sleek, dark-themed interface optimized for both desktop and mobile.
- **Fluid Interactions:** Blender-style edge detachment (drag from input to disconnect) and auto-snap.
- **Persistence System:**
  - **Auto-Save:** Sessions are cached using `useMouth` (LocalStorage).
  - **Manual Controls:** Save, Load, and Reset directly from the UI panel.
  - **Export:** Download graph state as JSON for backup or sharing.
- **Mobile Optimizations:** Built-in virtual keyboard avoidance and touch-friendly controls.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Graph Engine:** [@xyflow/react](https://reactflow.dev/) (React Flow)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **State Management:** React-based dependency tracking for the calculation engine.
- **Utilities:** [Sonner](https://sonner.emilkowal.ski/) (Toasts), [Nanoid](https://github.com/ai/nanoid) (IDs), [MathJS](https://mathjs.org/) (Symbolic Math)

## 🔄 System Architecture

input-output adopts a unique "Body Metaphor" for its codebase naming convention:

- **🧠 Brain** (`src/engine/Brain.ts`): The core computational engine.
- **⚡ Nerves** (`src/nerves/`): Custom hooks connecting the Brain to the Body (e.g., `useHand` for interactions, `useEye` for viewport).
- **🧍 Body** (`src/components/Body.tsx`): The main React Flow canvas.

> [!TIP]
> **For Developers:**
> Deep linguistic details, the "Black Magic" of the engine, and the atomic design philosophy are documented in [DEVELOPMENT.md](./DEVELOPMENT.md).

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

### Testing

Run the test suite with:

```bash
npm test
# or for a single run
npm run test:run
```

## 🔮 Future Roadmap

- [x] **Advanced Math:** Support for trigonometry, powers, and roots (Math Nodes).
- [x] **Persistence:** Local storage auto-save and manual controls.
- [x] **Export:** Save your graphs as JSON.
- [x] **Logic Gates:** Integration of `if/else` and comparison operators.
- [x] **Auto Layout:** Intelligent graph organization (Elk.js).
- [ ] **Export Options:** Save graphs as high-resolution images (PNG/SVG).
- [ ] **Cloud Sync:** Multi-device synchronization.

---
Built with ❤️ by the input-output Team.
