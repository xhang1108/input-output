---
title: System Architecture & Performance
order: 1
icon: Layers
---

# Core Execution & Performance

While the high-level architecture follows a "Digital Organism" metaphor, the internal mechanics rely on a robust transaction-based execution engine.

## 1. Core Execution Cycle

When a node's data or connection changes, the system triggers the **Dirty Chain**:
1. **Mark Dirty**: Identifies the changed node and all downstream dependencies. This is an $O(N)$ operation where $N$ is the number of downstream nodes.
2. **Compute Path**: Sorts the nodes topologically to prevent circular evaluation and redundant calculations.
3. **Lazy Evaluate**: Invokes pure `Evaluator` functions from the `NodeRegistry` only when a terminal node (e.g., a Plot or Final Output) requests a value.
4. **Broadcast**: Fires a `graphChanged` event. All connected UI nodes refresh their display results.

## 2. The Transaction System

Every persistent mutation to the state (Adding a node, connecting an edge) MUST be wrapped in an atomic **Transaction** using `applyTransaction`. 

This architecture provides:
- **Perfect Undo/Redo**: Since every action is recorded as a JSON patch array, the `TransactionManager` can jump between any point in time with 100% fidelity.
- **Serialization**: The entire graph state can be exported as a "Recipe" (IOGL structure) and re-hydrated instantly.

## 3. Performance Cycles (The Heartbeat)

To guarantee a smooth 120 FPS experience during continuous UI interactions without blocking the main engine, we use two distinct cycles:

- **The Stable Cycle**: The deep-thinking mode of the Brain. It handles topological sorting and complex logic. It runs when a stable transaction occurs (e.g., dropping a node).
- **The Transient Cycle (Spinal Reflex)**: During continuous high-frequency interactions (like dragging a slider), the **useEye** and **useEar** nerves handle transient state updates. The Brain applies a **Light Evaluation Pass** and purposefully does NOT record these micro-movements in the history stack, preventing the "Snapshot Trap."

## 4. The React Flow Bypass
When physically moving a node across the canvas, we rely on **useEye**'s integration with React Flow's CSS transform matrix. The state only syncs the final `(X, Y)` coordinate back to the Brain upon completion, achieving zero-latency framerates even on massive, logic-heavy canvases.
