---
title: Contributing Guide
order: 1
icon: Layers
---

# Contributing Guide

Excellent! We appreciate your interest in advancing the Input-Output ecosystem.

## Core Principles
- **TypeScript First**: All logic is strictly typed.
- **Pure Logic**: Functional nodes should have zero side effects and zero DOM dependencies.
- **IOGL Compliance**: Any new node must be registered in the `IOGL-Scribe` catalog.

## How to Add a New Node

### 1. Define Metadata
Add the node's visual definition (ID, handles, icon) to `src/definitions/nodeDefinitions.ts`.

### 2. Implement Evaluator
Write the pure computation function in `src/engine/nodes/`. Follow the naming convention `[node-id].eval.ts`.

### 3. Register in NodeRegistry
Include the new evaluator in the `NodeRegistry` to let the Brain recognize it.

### 4. Create UI Implementation
If the node requires custom UI (e.g., a specific slider or display), implement it in the `src/components/nodes/` gallery using our **Atomic Design** system.

## Performance Protocol

1. **Snapshots**: Use `Immer` for all `Brain` transactions. Never mutate state directly.
2. **Debounce**: Transient UI states (dragging) should use a 50ms buffer before updating the Brain.
3. **Matrices**: Heavy data structures should be handled as `REF` types only. Avoid copying large arrays in history.

## Submission Workflow
1. Create a feature branch (`feature/your-id`).
2. Run `npm test` to verify zero regression.
3. Submit a PR. Provide a demo video or screenshot if UI changes are involved.
