---
title: Transaction System
order: 2
icon: Zap
---

# 📜 Transaction System

The **Transaction System** is the mechanism for persistent state mutation and history tracking in I/O.

## 1. Atomic Mutation
Every change to the project state (Adding a node, connecting an edge, updating data) MUST be wrapped in a **Transaction**. This ensures that the system is never in an inconsistent state.

```typescript
// Example: Adding a node
brain.applyTransaction({
    type: 'ADD_NODE',
    payload: {
        id: 'node-1',
        type: 'IN-01',
        position: { x: 100, y: 100 },
        data: { value: 0 }
    }
});
```

## 2. Undo & Redo (Timeline)
The `TransactionManager` tracks a linear history of all snapshots.
- **Undo**: Reverts to the previous state by popping from the history stack.
- **Redo**: Re-applies a previously undone transaction.
- **Persistence**: Since every action is recorded as a JSON object, the entire project timeline can be saved and restored with 100% fidelity.

## 3. Propagation Control
To optimize performance, transactions can distinguish between **Persistent** and **Transient** updates:
- **Persistent**: Recorded in history (e.g., node creation).
- **Transient**: Not recorded in history (e.g., intermediate slider values during drag). This prevents the "Snapshot Trap" where millions of micro-movements clutter the undo stack.

> [!IMPORTANT]
> When building custom nodes, always use `UPDATE_NODE_DATA` for any state that should be saved in the project file.
