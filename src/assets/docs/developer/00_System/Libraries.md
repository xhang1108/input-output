---
title: Libraries & Dependencies
order: 3
icon: Wrench
---

# Libraries & Dependencies

The Input-Output system is built on a curated stack of modern libraries, chosen for their performance, reliability, and precision.

## Core Dependencies

### 1. mathjs
- **Purpose**: The primary mathematical engine for all node evaluations.
- **Why**: Supports arbitrary precision arithmetic (BigNumber), complex numbers, and complex matrix operations out of the box. It provides the robust foundation needed for engineering-grade calculations.

### 2. nerdamer
- **Purpose**: Symbolic mathematical expressions.
- **Why**: Used in specialized calculus nodes for symbolic differentiation, integration, and algebraic simplification.

### 3. @xyflow/react (React Flow)
- **Purpose**: The interactive canvas and node-edge management system.
- **Why**: Offers a high-performance, customizable framework for building node-based editors. It handles zoom, pan, and dragging efficiently.

### 4. zustand
- **Purpose**: Global state management for the UI layer.
- **Why**: Extremely lightweight and unopinionated. It allows for high-frequency updates (e.g., during dragging) without the boilerplate of Redux or the performance overhead of React Context.

### 5. immer
- **Purpose**: Immutable state management.
- **Why**: Used within the Brain's transaction system to create atomic patches. It allows for "mutative" syntax while ensuring strict immutability, which is critical for our Undo/Redo historical fidelity.

## Presentation & UI

### 6. elkjs
- **Purpose**: Automatic graph layout algorithms.
- **Why**: Provides professional-grade layout engines for "Auto-Tidy" features and IOGL script compilation visuals.

### 7. vega & vega-lite
- **Purpose**: Declarative visualization for plotting nodes.
- **Why**: Allows users to create complex charts and data visualizations using a JSON-based grammar of graphics.

### 8. framer-motion
- **Purpose**: Micro-animations and layout transitions.
- **Why**: Provides the "premium" feel and fluid UI interactions that define the Input-Output experience.
