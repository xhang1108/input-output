# 🌳 Calctopus AST Specification (The "Skeleton")

This document defines the structure of the internal Abstract Syntax Tree (AST) used for computation.

## 🎯 Purpose
- **Speed**: Unlike LaTeX (which requires parsing), AST is a direct tree structure that can be traversed instantly.
- **Precision**: Eliminates semantic ambiguity present in string-based expressions.
- **Compatibility**: Maps 1:1 to MathJS and Algebrite internal representations.

## 🧬 AST Node Structure

```typescript
type ASTNode = 
  | ScalarNode 
  | SymbolNode 
  | OperatorNode 
  | FunctionNode 
  | UnitNode 
  | MatrixNode;

interface BaseNode {
  sourceId: string;   // The React Flow Node ID for 1:1 mapping & traceability
}

interface SymbolNode extends BaseNode {
  type: 'symbol';
  name: string;       // Human-readable symbol (e.g., "Speed", "x")
}

interface OperatorNode extends BaseNode {
  type: 'operator';
  op: '+' | '-' | '*' | '/' | '^';
  args: ASTNode[];
  latexTemplate: string; // e.g., "{0} + {1}"
}
```

---

## ⚖️ The Law of Faithfulness (忠實記錄原則)

To ensure the engine preserves user intent and facilitates "Reverse Engineering" (Phase 3), the following rules apply:

1.  **1:1 Structural Mirror**: Every edge and node on the canvas must have a corresponding entry in the AST. 
2.  **No Silent Simplification**: The engine **must not** auto-simplify expressions (e.g., `x * 1` should remain `x * 1` in the "Soul"). Numerical computation (Body) handles the result, but the "Soul" remains a faithful skeleton.
3.  **Source Traceability**: Every AST node carries its `sourceId`, allowing the UI to highlight specific nodes when interacting with the LaTeX formula.

---

## 📝 Discussion Log
- **[2026-01-26]**: Initial discussion. Goal is to use AST as the internal "Blood" (computation) while keeping LaTeX as the "Soul" (display).
- **[2026-02-03]**: Standardized the "Law of Faithfulness". AST is now a mirror of the UI graph.
