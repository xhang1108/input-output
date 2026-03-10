---
title: The Body Metaphor
order: 1
icon: Layers
---

# 🧠 The Body Metaphor: System Architecture

The Input-Output System is architected around the anatomical metaphor of a "Digital Organism." This conceptual framework ensures a clear separation of concerns between state management, user interface, and sensory processing.

## 1. The Brain (Engine Core)
Located at `src/engine/Brain.ts`, the **Brain** is the single source of truth for the project state.
- **Pure Logic**: It has no dependency on the DOM or React.
- **Topological Graph**: It maintains the connectivity and data types of every node.
- **Transaction Log**: Every change is atomic, enabling perfect Undo/Redo and Project Persistence.

## 2. The Nerves (Hooks & Event System)
The **Nerves** (found in `src/nerves/` and `src/hooks/`) act as the bidirectional communication layer.
- **Sensory Input**: Hooks like `useEar` listen for keyboard shortcuts.
- **Motor Control**: Hooks like `useBrainSync` translate React Flow UI interactions into Brain transactions.
- **Spinal Reflex**: Real-time UI updates (like dragging) happen at 120fps by bypassing the Brain for visual-only state.

## 3. The Body (UI Layer)
The **Body** (found in `src/components/Body.tsx`) is the visual manifestation of the system.
- **React Flow**: Orchestrates the canvas rendering.
- **Atomic Nodes**: Individual components that visualize the Brain's state.
- **Proactive Feedback**: The Body pulls from the Brain's results to display live data flow.

---

## 🔧 Engineering Deep Dive: The Pulse
When a value changes (e.g., a Slider is moved), the system triggers a **Pulse**:
1. **Trigger**: Slider Node emits a local change.
2. **Transaction**: `useBrainSync` dispatches an `UPDATE_NODE_DATA` transaction to the Brain.
3. **Evaluation**: Brain identifies "Dirty" downstream nodes.
4. **Broadcast**: `graphChanged` event is fired.
5. **UI Pull**: All connected nodes refresh their display results.

> [!TIP]
> This architecture allows the system to remain portable. The **Brain** can theoretically run in a headless environment or the Cloud, while the **Body** can be swapped for a different UI renderer.
