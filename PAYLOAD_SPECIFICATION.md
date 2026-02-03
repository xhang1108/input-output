# 📦 Calctopus Data Payload Specification

This document defines how data and symbols travel between nodes.

## 🎯 Requirements
- **Symbolic Truth**: Every node must contribute to a LaTeX expression.
- **Numerical Performance**: High-speed calculation (matrices, scientific).
- **Unit Metadata**: Carrying physical units (km, kg, $) through the wires.
- **Visual Mapping**: Data types map to wire colors (Blender style).

## 🧬 Core Payload Structure (The "Soul & Body")

As defined in the [ENGINE_ARCHITECTURE.md Bible](file:///d:/Antigravity/Calctopus/ENGINE_ARCHITECTURE.md), every connection must carry a `NodePayload` that facilitates distributed evaluation.

```typescript
interface NodePayload {
  soul: ASTNode;      // The "Soul" - Internal AST structure for LaTeX & Symbolic ops
  body: any;          // The "Body" - Pre-calculated value (BigNumber or TypedArray)
  unit: string | null;// Support for physical units (km, kg, etc.)
  type: DataType;     // Scalar, Matrix, Error, etc.
  isDirty: boolean;   // Status flag for current update cycle
}
```

### 🏎️ Precision & Performance (The "Body" Logic)

Users can toggle the Engine's calculation strategy globally or per-node:

1.  **Auto (Default)**: Automatically switches to `TypedArray` when data size exceeds the performance threshold (e.g., 10,000 matrix elements), otherwise stays in `BigNumber`.
2.  **Precision (準確)**: Forces `BigNumber` (MathJS) for all operations. Ensures 64+ significant digits but may lag on large matrices.
3.  **Speed (快速)**: Forces `TypedArray` (Float64) for all operations to ensure maximum throughput. Precision is limited to ~15 digits.

- **Down-casting**: In all modes, if a `BigNumber` interacts with a `TypedArray`, the `BigNumber` is converted to a native number to maintain calculation speed.

### ⚛️ Evaluation Rules
1. **Body-First Distribution**: Each node's `body` is calculated using the `body` values of its immediate parents.
2. **Soul Linkage**: Each node's `soul` is a new AST node that wraps the `soul` of its parents.
3. **Adaptive Fulfillment**: If the downstream request is "Value-only", the `soul` generation can be skipped to save memory.

---

## 🎭 The "Better than LaTeX" Question: LaTeX vs. AST

| Feature | LaTeX (String) | AST (Abstract Syntax Tree) |
| :--- | :--- | :--- |
| **Human Readable** | 100% (The Goal) | 0% (Developer only) |
| **Logic Speed** | Slow (Needs Parsing) | **Fast** (Native to MathJS) |
| **Complexity** | High (Syntax errors) | Low (Structurally rigid) |
| **Verdict** | Use for **UI & Export** | Use for **Internal Engine** |

---

## ⏳ Undo & History (Scheme B)
- **Concept**: Action Path / Command Pattern.
- **Logic**: Record `commands` (e.g., `UpdateValue`, `LinkNodes`) instead of `states`.
- **Granularity**: Allows undoing every tiny character change or node movement.
