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
  body: any;          // The "Body" - The pre-calculated numeric/matrix value (Atomic Cache)
  unit: string | null;// Support for physical units (km, kg, etc.)
  type: DataType;     // Scalar, Matrix, Error, etc.
  isDirty: boolean;   // Status flag for current update cycle
}
```

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
