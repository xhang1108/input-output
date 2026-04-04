---
title: Data Flow
order: 3
---

# Data Flow

The Input-Output engine is built on a **Hybrid Push-Pull** architecture. This dual-track system ensures that we only compute what is necessary, exactly when it is needed, while maintaining a smooth 120 FPS interface.

## 1. The Push Model (Downstream Pulse)
When a source node changes (a "Sensory Event"), the **Brain** initiates a **Push Pulse**.
- **Direction**: Flows downstream following the graph's dependency edges.
- **Action**: Nodes are added to a `dirtySet` and marked as "Invalidated" (dirty).
- **Goal**: Inform the system about *what* might need re-calculation without actually performing any math.
- **Performance**: Marking a node is a zero-latency $O(1)$ operation, preventing the UI from freezing during continuous interactions.

## 2. The Pull Model (Upstream Evaluation)
Calculations are performed only when a result is requested for display or synchronization.
- **Direction**: Computation pulls data upstream from ancestors towards the target node.
- **Ordering**: The system uses a **Topological Sort** of the `dirtySet` to ensure the correct order of operations.
- **Offloading**: High-complexity solving (Calculus, Matrices) is offloaded to **Web Workers** via the `BrainWorkerProxy`.
- **Goal**: Maximize efficiency by skipping calculations for nodes that are dirty but currently off-screen or not needed for the current output.

## 3. The Hybrid Cycle
This combined model means the system "Senses" change via **Push** and "Thinks" about the result via **Pull**.
- **Efficiency**: Prevents redundant calculations in large, complex graphs.
- **Responsiveness**: Keeps the foreground (UI) fluid while the background (Worker) handles the precision math.
- **Guards**: The `TopologyManager` prevents internal cycles, and the global `mathConfig` ensures unified precision across both Push and Pull stages.
