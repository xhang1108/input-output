---
title: Data Symbology
order: 3
icon: Zap
---

# Data Symbology

The I/O System uses a **Color-Type Mapping** system to ensure zero-error signal routing.

## 1. Port Color Coding
| Color | Data Type | Description |
| :--- | :--- | :--- |
| `Amber` | Scalar | Real numbers (BigNumber precision) |
| `Blue` | Matrix | 2D Arrays and Tensors |
| `Emerald` | Geometry | Vector and Path data |
| `Violet` | Logic | AST and Symbolic expressions |

## 2. Connection Topology
- **Single Slot (Input)**: Connects to one producer. New connections displace old ones.
- **Capsule (Multi)**: Supports link stacking for aggregators like `data:builder`.
- **Ghost Edges**: Occur when metadata mismatches (Visible in Debug View).

## 3. Signal Flow
Signal propagates from **Output (Source)** to **Input (Target)**. The engine enforces a strict `DAG` (Directed Acyclic Graph) to prevent infinite loops.
