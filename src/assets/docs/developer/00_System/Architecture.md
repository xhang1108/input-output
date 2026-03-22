---
title: Architecture
order: 2
icon: Wrench
---

# System Architecture

The Input-Output engine operates on a multi-layered architecture designed for ultra-low latency and consistent state management.

## Components

### 1. Brain (State Orchestration)
The **Brain** acts as the central hub for all project state. It manages:
- **Node Topology**: Dependency graph of all functional units.
- **Transaction Log**: Atomic patches that represent state transitions.
- **Subscription Model**: Reactive updates to the UI layer.

### 2. MathEngine (Pure Logic)
A portable, high-precision mathematical evaluator.
- Powered by `mathjs` and `nerdamer`.
- Capable of symbolic calculus and matrix operations.

### 3. Worker Proxy
Offloads heavy computation to a separate thread, ensuring the UI remains responsive at 120fps even during complex evaluations.

## Data Flow
> [!IMPORTANT]
> All communication follows a `Producer -> Consumer` direction. Edges always originate from an Output port.
