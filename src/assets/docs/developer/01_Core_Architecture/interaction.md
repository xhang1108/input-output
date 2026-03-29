---
title: Interaction
order: 4
icon: MousePointer
---

# Interaction

Input-Output separates user-driven interactions from the core calculation cycle to ensure a zero-latency (120 FPS) experience without sacrificing data integrity or mathematical precision.

## 1. Interaction Models
The system distinguishes between **Transient** maneuvers and **Persistent** state changes.

### Transient Interaction (Interaction Layer)
- **Context**: Real-time maneuvers like dragging a node across the canvas, resizing a frame, or sliding a value.
- **Latency**: 0ms. Handled entirely within the UI layer (React Flow) and the `Interaction Layer` hooks.
- **Behavior**: These updates provide immediate visual feedback. They are **not** committed to the `TransactionManager` to avoid intermediate coordinate noise.

### Committed Transactions (Core Engine)
- **Context**: Finalized actions such as `onDragStop`, `onSliderRelease`, or formal property committing.
- **Behavior**: Upon completion of a gesture, the final state is committed to the **Brain** as an **Atomic Transaction**.
- **History**: Every commitment generates a JSON patch, recording the action for IOGL serialization and persistence.

## 2. Coordination (The Transaction Lifecycle)
1. **Gesture Start**: `useHand` captures the initial state of the affected nodes.
2. **Streaming**: High-frequency updates are pushed directly to the UI components.
3. **Gesture End**: `useHand` calculates the total delta and calls `brain.applyTransaction()`.
4. **Validation**: The Brain validates the transaction (e.g., checking for new cycles or unauthorized connections).
5. **Finalization**: The change is crystallized, the `dirtySet` is updated, and the Pulse Wave begins.

## 3. Interaction Guards
- **Snap-to-Grid**: Mathematical alignment enforced at the Interaction Layer.
- **Boundary Detection**: Prevents nodes from being moved into invalid spatial states or unauthorized parent frames.
- **Event Debouncing**: Transient states are debounced (~50ms) before hitting the Brain's evaluation loop to maintain performance.

---

> [!TIP]
> This dual-track model ensures that the interface feels as fluid as a design tool while maintaining the rigorous precision of a scientific calculator.
