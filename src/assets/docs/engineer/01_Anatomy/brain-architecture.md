---
title: Brain Architecture
order: 1
icon: Layers
---

# Brain Architecture (`src/engine/Brain.ts`)

The **Brain** is a Singleton orchestrator and the ultimate authority on system state.

## 1. Core Principles
- **SSOT (Single Source of Truth)**: All node data, edge topology, and project metadata reside in the Brain's store.
- **Atomic Operations**: State updates are performed via **Transactions** using `Immer` to ensure structural sharing and safe undo/redo.
- **Delta propagation**: The engine only communicates changes (patches) between the UI and worker threads.

## 2. Execution Cycle
When a node's data or connection changes, the Brain triggers the **Dirty Chain**:
1. **Mark Dirty**: Identify the changed node and all downstream dependencies.
2. **Compute Path**: Sort the dirty nodes topologically to prevent circular evaluation.
3. **Dispatch**: Send the computation requests to the `MathEngine`.
4. **Patch**: Apply the results back to the store and notify UI subscribers.

## 3. Persistent Storage
All graph data is serialized into **IOGL 2.0** format for local storage or cloud synchronization.
