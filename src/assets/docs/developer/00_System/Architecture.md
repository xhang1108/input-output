---
title: Architecture
order: 2
icon: Wrench
---

# System Architecture

The Input-Output engine is architected as a **Digital Organism**. We separate "Thinking" from "Sensing" to maintain a clean boundary between mathematical logic and user interaction.

## 1. The Brain (The Mind)
*   **Source**: `src/engine/Brain.ts`
*   **Role**: The central source of truth and the "Command Center".
*   **Core Responsibilities**:
    *   **Computation**: Handles all mathematical evaluations and data transformations.
    *   **Topology Manager**: Orchestrates the "Dirty Chain" to ensure efficient incremental updates.
    *   **Transaction Log**: Maintains an immutable history of all graph changes for perfect Undo/Redo.

## 2. The Nerves (The Senses)
These specialized React hooks act as sensory organs, translating physical interactions into digital commands for the Brain.

### useHand (The Gesture Orchestrator)
*   **Source**: `src/hooks/nerves/useHand.ts`
*   **Role**: Manages all physical interactions with nodes.
*   **Capabilities**: Orchestrates grabbing, scaling, rotating, and autopanning. It composes the utility hooks for a complete motor system.

### useEye (The Visual Nerve)
*   **Source**: `src/hooks/nerves/useEye.ts`
*   **Role**: Manages the system's "Sight"—the React Flow viewport.
*   **Capabilities**: Handles camera focus, automatic view fitting (fitView), and spatial awareness of nodes on the infinite canvas.

### useEar (The Auditory Nerve)
*   **Source**: `src/hooks/nerves/useEar.ts`
*   **Role**: "Listens" to keyboard events and global shortcuts.
*   **Capabilities**: Dispatches system actions (like Undo/Redo/Delete) and manages low-level key state tracking.

### useMouth (The Oral Organ)
*   **Source**: `src/hooks/nerves/useMouth.ts`
*   **Role**: Handles all Data I/O—Import (Eating) and Export (Speaking).
*   **Capabilities**: Generates IOGL/JSON blueprints and consumes LaTeX strings to "feed" the Brain new logic.

### useNose (The Sniffer)
*   **Source**: `src/hooks/nerves/useNose.ts`
*   **Role**: Detects data types and property "scents" in a passive manner.

## 3. The Tools (Utility Hooks)
Auxiliary logic providers located at the `src/hooks/` root.

*   **layoutEngine.ts**: High-performance ELK-based graph layout calculations.
*   **useKnife.ts**: Surgical tool for slicing connections.
*   **useSelection.ts**: Logic for complex multi-node operations (Bundle, Swap, Reset).
*   **useClipboard.ts**: Persistence layer for "Genetic Copying" (Copy/Paste).

## 4. The Body (The Manifestation)
*   **Source**: `src/components/Body.tsx`
*   **Role**: The physical interface. It "Pulls" current results from the Brain and renders them onto the canvas using the React Flow viewport managed by **useEye**.
