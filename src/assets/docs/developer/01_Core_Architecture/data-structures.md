---
title: Data Structures
order: 5
---

# Data Structures

At the heart of the Input-Output system is a high-performance evaluation engine that manages complex dependencies and large-scale mathematical computations.

## 1. Internal Data Structures

The **Brain** maintains the global project state using three primary structures:

### GraphState
The `GraphState` is the source of truth for all nodes and their relationships.
```typescript
interface GraphState {
    nodes: Map<string, NodeLogic>;
    edges: Edge[];
}
```

### NodeLogic
Each node represents a discrete functional unit within the graph.
```typescript
interface NodeLogic {
    id: string;
    type: string;
    data: any;           // UI and configuration data
    value: NodePayload;  // The actual computed result
    isInDirtyChain: boolean;
}
```

### NodePayload
To ensure cross-node compatibility, all data is wrapped in a `NodePayload`. This allows the engine to handle `BigNumber`, `Matrix`, and primitive types uniformly.
```typescript
interface NodePayload {
    type: 'number' | 'matrix' | 'string' | 'error' | 'boolean' | 'any';
    value: any;
    meta?: Record<string, any>;
}
```

## 2. Evaluation Cycle

The system uses a **Topological Management** system to handle complex dependencies.

1. **Transaction**: A user action changes node data or an edge.
2. **Dirty Trigger**: The system marks all downstream nodes as `isInDirtyChain = true`.
3. **Worker Offloading**: If the computation is heavy or asynchronous, the Brain serializes the dirty nodes and pushes an `IncrementalPatch` to the **Worker Proxy**.
4. **Calculated Pull**: The evaluation engine (whether in the main thread or worker) recursively pulls the values of required inputs.
5. **Patch Apply**: Results are returned as a map of `NodePayload` objects and applied atomically to the Brain's state.

## 3. The Worker Proxy

To maintain 120 FPS on the UI thread, heavy lifting is offloaded to a Web Worker.

- **Dynamic Loading**: Libraries like `mathjs` and `nerdamer` are loaded only when a calculation is needed.
- **Serialization**: The `BrainWorkerProxy` is responsible for building a minimized snapshot of the graph (only the dirty chain and its inputs) to send to the worker.
- **Async Boundary**: All worker calls are asynchronous. While the worker computes, the UI remains fully interactive.
