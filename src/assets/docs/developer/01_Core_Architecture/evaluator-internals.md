---
title: Evaluator Internals
order: 3
icon: Cpu
---

# System Evaluator Internals

The **Evaluator Engine** is the execution heart of the I/O system, responsible for resolving the entire node graph into concrete mathematical payloads. It lives primarily within `Brain.ts` and `NodeRegistry.ts`.

## 1. Topological Sorting
Before evaluation begins, the Brain must determine the correct order of execution to satisfy all dependencies. This is done via **Topological Sorting**:
1. The engine constructs an adjacency list identifying all `Source -> Target` edges.
2. It detects cycles. If a cycle is found (e.g., A -> B -> A), the graph is marked as invalid, and execution halts to prevent infinite loops.
3. Nodes with no incoming dependencies are executed first, cascading down to the final Output nodes.

## 2. The NodeRegistry
The `NodeRegistry` is a centralized dictionary mapping every `nodeType` (e.g., `MA-01`, `IN-10`) to a pure function known as an **Evaluator**.

```typescript
// Anatomy of an Evaluator Function
(node: NodeLogic, inputs: Map<string, NodePayload>) => NodePayload
```

An Evaluator receives:
- **`node`**: The local state and parameters of the node (e.g., Which operation is selected).
- **`inputs`**: A Map of all incoming data payloads mapped by their target handle IDs.

## 3. The Execution Cycle
When a `graphChanged` event fires (via `applyTransaction`), the Brain triggers `evaluate()`:
1. **Gather**: For a given node, the Brain fetches the pre-calculated outputs of its dependencies.
2. **Evaluate**: The Brain invokes the registered Evaluator from `NodeRegistry.ts`.
3. **Store**: The resulting `NodePayload` is stored in the node's `visualState.result`.
4. **Propagate**: Downstream nodes repeat the cycle using this new result.

## 4. Error Handling & Payload Wrapping
All data flowing through edges is wrapped in a `NodePayload` object:
```typescript
interface NodePayload {
    type: 'scalar' | 'matrix' | 'string' | 'error' | ...;
    value: any;
    // ... metadata
}
```
If an Evaluator encounters a mathematical impossibility (e.g., dividing by zero, or matrix dimension mismatch), it catches the exception and returns a payload of `type: 'error'`. The UI components read this payload and render a red error boundary around the node.

> [!TIP]
> Evaluators are strictly designed as **Pure Functions**. They do not mutate global state, making them highly testable.
