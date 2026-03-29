---
title: System Architecture
order: 1
icon: Brain
---

# System Architecture

The Input-Output engine is structured with a clear separation of concerns between its **Core Engine** (Logic), **Sensory Hooks** (Interaction), and **UI Layer** (Manifestation). This decoupling ensures high-cadence performance while maintaining strict mathematical consistency.

## 1. Core Engine (Brain)
The **Brain** (`src/engine/Brain.ts`) is the central source of truth for the system.
- **State Management**: Orchestrates the `GraphState` and provides the primary API for all graph mutations.
- **Calculation Orchestration**: Manages the dependency graph and triggers evaluation cycles.
- **Transaction Handling**: Interacts with the `TransactionManager` to apply atomic graph changes and manage serialization.
- **Offloading**: Communicates with Web Workers via the `BrainWorkerProxy` for asynchronous evaluation.

## 2. Sensory Hooks (Interaction Layer)
These components act as the interface between user events and the Core Engine.
- **Input Hooks**: Specialized hooks (located in `src/hooks/nerves/`) that translate raw browser events (mouse, keyboard, touches) into engine commands.
- **Context Awareness**: They monitor the current viewport and project screen coordinates into the engine's coordinate space.
- **Detailed Docs**: See the [System Hooks Catalog](./hooks.md) for individual specifications.

## 3. Utility Hooks (Support Logic)
Located at `src/hooks/`, these provide specialized graph operations:
- **Layout Management**: Direct interface with the `elkjs` engine via `layoutEngine.ts`.
- **Manipulation Tools**: Including `useKnife.ts` for edge deletion and `useClipboard.ts` for state serialization and cloning.

## 4. UI Layer (Body)
- **Source**: `src/components/Body.tsx`
- **Role**: The visual implementation of the engine. It performs a "Pull" of computed results from the Brain and renders them onto the canvas. It is responsible for the final presentation of calculation node outputs and visual states.

---

## High-Performance Update Cycles
To guarantee a 120 FPS experience, the system separates transient input from persistent state updates:

### Transient Updates (Interaction)
- **Context**: Continuous user actions such as dragging a node or adjusting a slider.
- **Behavior**: The Interaction Layer updates the UI state immediately. These high-frequency updates are not committed to the `TransactionManager` to avoid unnecessary processing cycles.

### Committed Transactions (Persistence)
- **Context**: Finalized actions like `onDragStop` or `onSliderRelease`.
- **Behavior**: The final state of the interaction is committed as an **Atomic Transaction** to the Brain, triggering graph synchronization.

> [!NOTE]
> This separation allows for zero-latency interactions while maintaining persistent, engineer-grade graph modifications.
