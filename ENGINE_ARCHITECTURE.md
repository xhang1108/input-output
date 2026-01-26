# ⚙️ Calctopus Engine Architecture Discussion

This document tracks the evaluation and final decision for the calculation engine of Calctopus.

## 🏃 Current Candidates

### 1. Push Engine (Eager Evaluation)
- **Concept:** When an input changes, it immediately propagates updates to all downstream nodes.
- **Pros:** 
    - Real-time reactivity is "baked in".
    - Conceptual simplicity (Data flows like water).
- **Cons:** 
    - Performance heavy on large graphs (recalculates everything).
    - Harder to handle complex recursion or cycles without infinite loops.

### 2. Pull Engine (Lazy Evaluation)
- **Concept:** Only calculate a node's value when a "Sink" node (Result/Monitor) requests it.
- **Pros:** 
    - Naturally supports Dead Code Elimination (DCE).
    - Highly efficient for massive graphs.
    - Simplified recursion and cycle detection.
- **Cons:** 
    - Requires a "request signal" to start calculation.
    - Potential latency "pop" on first calculation.

### 3. Hybrid Pull Engine (Push Signal, Pull Data)
- **Concept:** Inputs send a "Dirty" signal downstream (Push). Result nodes, seeing they are dirty, request fresh data (Pull) when needed.
- **Pros:**
    - Combines reactivity with lazy evaluation efficiency.
- **Cons:**
    - Most complex implementation.

---

## 📝 Discussion Log

- **[2026-01-26]**: Initial project rebirth. Decision pending. The goal is a flexible system that handles expert-level complexity.
- **[2026-01-26]**: **Calculation Boundary Decided**. All mathematical and logical calculations happen **Client-Side** via **Web Workers**. Cloud infrastructure (Cloudflare) is strictly for persistent storage and retrieval (D1/Workers), NOT for calculation.

## 🏁 Final Verdict
PENDING...
