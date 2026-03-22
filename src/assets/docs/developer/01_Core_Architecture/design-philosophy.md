---
title: Design Philosophy
order: 2
icon: Zap
---

# Design Philosophy

The Input-Output system is designed to handle high-frequency interactions (120 FPS) while maintaining a globally consistent, engineer-ready mathematical state.

## The Hybrid Push/Pull Model

The core of our evaluation engine is a **Hybrid Push/Pull** system. This architecture ensures that we only compute what is strictly necessary, exactly when it needs to be updated.

### 1. The Pulse Wave (Push)
When a node's internal state or its input connections change (a "Sensory Event"), the **Brain** triggers a **Dirty Chain** propagation.
- **Direction**: From the source node downstream to all children.
- **Goal**: Mark nodes as "Dirty" (out-of-date) without immediately recalculating them.
- **Why**: Recalculating everything immediately on every slider movement would freeze the UI. Marking them as dirty takes $O(1)$ time per node.

### 2. Recursive Evaluation (Pull)
Calculations are performed only when a value is requested (e.g., by the UI for display or by the Worker for a background pass).
- **Direction**: Upstream from the target node towards its ancestors.
- **Mechanism**: The `getValue()` function recursively pulls values from its inputs. If an input is "Dirty," it is recalculated.
- **Why**: This minimizes redundant work. If a node is dirty but off-screen and not being used for any current output, it remains uncalculated.

## Spinal Reflex vs. Brain Logic

To maintain responsiveness, the system distinguishes between **Transient** and **Persistent** states.

### Spinal Reflex (Transient)
- **Context**: Rapid user actions like dragging a slider or moving a node.
- **Behavior**: The UI component updates its internal state at 120 FPS. The Brain applies a **Light Evaluation Pass**.
- **History**: These transient movements are **not** recorded in the Undo/Redo stack to prevent "Snapshot Overload."

### The Brain (Persistent)
- **Context**: Commit events like `onDragStop` or `onSliderRelease`.
- **Behavior**: A full **Atomic Transaction** is created. The topological graph is updated, and the new state is committed to the linear history.
- **History**: Every action here creates a perfect JSON patch, allowing for 100% fidelity in undo/redo and file serialization.

## Data Center Integrity

- **Output Authority**: Data flows strictly from **Outputs to Inputs**. An Input port is a consumer; it has no independent state.
- **No Cycles**: The topology manager enforces a Directed Acyclic Graph (DAG) for all calculations.
- **Unified Precision**: All operations within the engine share a single precision context, preventing "Rounding Drifts" common in heterogeneous math systems.
