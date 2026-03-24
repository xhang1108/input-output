---
title: System Hooks
order: 2
icon: GitBranch
---

# System Hooks

The Input-Output engine utilizes a structured set of React hooks to interface between the Core Engine (Brain) and the UI Layer. These hooks are categorized by their functional role in the system lifecycle.

## 1. Interaction Layer Hooks
**Location**: `src/hooks/nerves/`

These hooks handle raw browser events and translate them into engine-compatible coordinates and commands.
- **useHand**: Orchestrates manual node manipulation including dragging, scaling, and rotating.
- **useEye**: Manages viewport state, camera movement, and spatial focus (React Flow integration).
- **useEar**: Global keyboard event listener for dispatching system-wide commands (Undo, Redo, Delete).
- **useMouth**: Handles Data I/O, including IOGL blueprint imports and project exports.
- **useNose**: Validates port types and edge connectivity during interactive linking.

## 2. Engine Synchronization
**Location**: `src/hooks/`

Hooks responsible for keeping the UI and the Core Engine in sync.
- **useBrainSync**: **Sync-to-Engine**. Propagates physical canvas updates (e.g., node movement) back to the Brain state.
- **useBrainUpdates**: **Engine-to-UI**. Streams calculation results, specific node state changes, and evaluation errors from the Brain to the UI components.

## 3. Graph Manipulation
**Location**: `src/hooks/`

Utility hooks for structural graph operations.
- **useRelink**: Handles edge remapping and port connectivity updates.
- **useNodeSpawner**: Logic for instantiating and placing new nodes on the canvas.
- **useNodeParam**: Interface for nodes to read and write internal parameters to the global state.
- **useKnife**: Collision-based tool for deleting multiple edges in a single gesture.
- **useHandleMagnet**: Implementation of logical and visual snapping for edge creation.

## 4. Automation & Layout
**Location**: `src/hooks/`

- **useAutoLayout**: Interface for the high-performance ELK layout engine to organize graph topology.
- **useAutoInsert**: Logic for automatically inserting and connecting a node between two existing linked nodes.

## 5. System Services
**Location**: `src/hooks/`

- **useProjectSave**: Manages project serialization, compression, and persistence (Local/Cloud).
- **useClipboard**: Handles node/subgraph cloning and duplication logic.
- **useSelection**: Orchestrates batch operations (Swapping, Cascading, Grouping) on multiple selected nodes.
- **usePerformanceMonitor**: Telemetry for engine execution metrics, including FPS and calculation latency.

---

> [!NOTE]
> Any action that modifies the graph topology or node values must be committed as a **Committed Transaction** to the Brain to ensure data consistency and history integrity.
