---
title: System Architecture & Performance
order: 1
icon: Layers
---

# System Architecture Overview

The Input-Output System is architected around a clear separation of concerns, metaphorically structured like a "Digital Organism." 

## 1. The Body Metaphor

- **The Brain (`src/engine/Brain.ts`)**: The single source of truth for the project state. It is pure logic (no DOM dependency), maintains the topological graph, and evaluates the mathematical operations.
- **The Nerves (`src/nerves/` & `src/hooks/`)**: The bidirectional communication layer. Sensory inputs like keyboard shortcuts or mouse drags are translated into Brain transactions.
- **The Body (`src/components/Body.tsx`)**: The visual manifestation (React Flow canvas) that pulls data from the Brain to render the graph.

## 2. Core Execution Cycle

When a node's data or connection changes, the system triggers the **Dirty Chain**:
1. **Mark Dirty**: Identifies the changed node and all downstream dependencies.
2. **Compute Path**: Sorts the nodes topologically to prevent circular evaluation.
3. **Evaluate**: Invokes pure `Evaluator` functions from the `NodeRegistry`.
4. **Broadcast**: Fires a `graphChanged` event. All connected UI nodes refresh their display results.

## 3. The Transaction System

Every persistent mutation to the state (Adding a node, connecting an edge) MUST be wrapped in an atomic **Transaction** using `applyTransaction`. 
This allows the `TransactionManager` to maintain a linear history of all snapshots natively, giving us perfect **Undo/Redo** functionality. Since every action is recorded as a JSON patch array, the timeline can be saved with 100% fidelity.

## 4. Performance Cycles (The Heartbeat)

To guarantee a smooth 120 FPS experience during continuous UI interactions (like dragging sliders or moving nodes) without blocking the main engine, we use two distinct cycles:

- **The Stable Cycle**: The deep-thinking mode of the Brain. It handles topological sorting, complex math, and creates undo/redo history items. It runs when a stable transaction occurs (e.g., dropping a node or letting go of a slider).
- **The Transient Cycle (Spinal Reflex)**: During continuous high-frequency interactions (like dragging a slider), the React component updates its local visual state immediately. The Brain applies a **Light Evaluation Pass** and purposefully **does NOT record** these micro-movements in the Undo stack to prevent the "Snapshot Trap".

### The React Flow Bypass
When physically moving a node across the canvas, we rely *entirely* on React Flow's CSS transform matrix. The React hooks only sync the final `(X, Y)` coordinate back to the Brain upon the `onNodeDragStop` event, achieving zero-latency framerates on massive canvases.
