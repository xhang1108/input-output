---
title: Performance Cycles
order: 4
icon: Activity
---

# ⚡ Performance Cycles (The Heartbeat)

The I/O System guarantees a smooth 120 FPS experience during continuous UI interactions (like dragging sliders or nodes) without blocking the main mathematical engine. To achieve this, the architecture is split into two distinct performance cycles: **The Stable Cycle** and **The Transient Cycle**.

## 1. Stable Cycle (The Rational Brain)
The Stable Cycle is the slow, deep-thinking mode of the `Brain.ts` engine. It handles:
- Topological sorting.
- Complex matrix and differential computations.
- Firing `graphChanged` events.
- Creating undo/redo history items in `TransactionManager.ts`.

When a stable transaction occurs (e.g., you let go of a slider after dragging), the engine updates the graph and recalculates the exact minimum necessary downstream nodes.

## 2. Transient Cycle (The Spinal Reflex)
If the Stable Cycle ran every frame while you dragged an $N=5000$ Distribution Slider, the browser would instantly lock up. Instead, we use the **Spinal Reflex**.

During continuous interactions, the React component uses a local state hook to immediately update its own visuals (e.g., the slider knob moving):
```typescript
const [localValue, setLocalValue] = useState(initialValue);

const handleChange = (e) => {
    // 1. Immediate visual update (120 FPS)
    setLocalValue(val);
    
    // 2. Debounced push to Brain
    Brain.getInstance().applyTransaction({
        type: 'UPDATE_VALUE',
        payload: { id, value: val }
    });
}
```

The Brain detects high-frequency `UPDATE_VALUE` calls, skips the heavy Topological Sort, and applies a **Light Evaluation Pass**. Furthermore, transient state transitions are purposefully **NOT recorded** in the Undo stack. This prevents the "Snapshot Trap" where dragging a slider creates 300 undo actions.

## 3. The React Flow Bypass
When moving a node physically across the canvas:
- We rely *entirely* on React Flow's internal transform matrix. 
- The React hooks only sync the final `(X, Y)` coordinate back to the Brain upon the `onNodeDragStop` event.
- During the drag, the Brain is completely unaware the node is moving, achieving perfect 0-latency framerates even on massive canvases.
