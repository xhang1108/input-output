---
title: Libraries & Dependencies
order: 6
---

# Libraries & Dependencies

The Input-Output system is built on a curated stack of modern libraries, chosen for their performance, reliability, and mathematical precision.

## 1. Mathematical Core
- **[mathjs](https://mathjs.org/)**: The primary engine for all node evaluations. It provides support for arbitrary precision (`BigNumber`), complex numbers, and matrices.
- **[nerdamer](https://nerdamer.com/)**: Used for symbolic math, specifically in calculus nodes for differentiation and algebraic simplification.
- **[tex-math-parser](https://github.com/scitools/tex-math-parser)**: Converts LaTeX input into system-understandable mathematical expressions.

## 2. Graph & Interaction
- **[@xyflow/react](https://reactflow.dev/)**: The interactive canvas engine. It manages the node-edge relationship and rendering at high performance.
- **[elkjs](https://github.com/kieler/elkjs)**: A professional graph layout engine used for the "Auto-Tidy" and graph compilation features.

## 3. State & Infrastructure
- **[zustand](https://github.com/pmndrs/zustand)**: The lightweight state management layer for the UI. It handles high-frequency updates without the overhead of heavy context providers.
- **[immer](https://immerjs.github.io/immer/)**: Ensures strict immutability within the Brain's transaction system, facilitating reliable Undo/Redo.
- **[lz-string](https://pieroxy.net/blog/pages/lz-string/index.html)**: Provides high-performance compression for serialized graph "Blueprints," making shared links and local storage efficient.

## 4. UI & Presentation
- **[Next.js](https://nextjs.org/) & [React 19](https://react.dev/)**: The underlying framework for the entire application, utilizing Server Components for performance.
- **[Tailwind CSS](https://tailwindcss.com/)**: The utility-first CSS framework used for all styling, combined with `clsx` and `tailwind-merge` for dynamic classes.
- **[Radix UI](https://www.radix-ui.com/)**: A suite of unstyled, accessible UI primitives (Dialogs, Dropdowns, Selects) used to build the premium interface.
- **[Framer Motion](https://www.framer.com/motion/)**: Powers all micro-animations and smooth layout transitions.
- **[Lucide React](https://lucide.dev/)**: The vector icon library used across the entire platform.

## 5. Visualization & Formatting
- **[Vega](https://vega.github.io/vega/) & [Vega-Lite](https://vega.github.io/vega-lite/)**: Declarative visualization grammars used by plotting nodes to render high-complexity charts.
- **[KaTeX](https://katex.org/)**: The high-speed math typesetting engine used to render beautiful LaTeX formulas in the UI.
- **[React Markdown](https://github.com/remarkjs/react-markdown)**: Powers the dynamic documentation and wiki pages within the app.

## 6. Development & Testing
- **[Vitest](https://vitest.dev/)**: The unit testing framework used for validating Node Evaluators and Engine logic.
- **[Drizzle ORM](https://orm.drizzle.team/)**: The TypeScript ORM used for database interactions (Neon/PostgreSQL).

---

> [!TIP]
> All core mathematical libraries (`mathjs`, `nerdamer`) are dynamically loaded inside the **Web Worker** context to prevent blocking the main UI thread during initialization.
