---
title: LaTeX Functionality
order: 9
icon: Sigma
---

# LaTeX Functionality

Input-Output leverages LaTeX as a core communication layer between the underlying mathematical engine and the user interface. It provides a familiar, mathematically rigorous way to visualize and manipulate complex expressions.

## 1. Graph to LaTeX (Rendering)
The primary use of LaTeX is the visual representation of node logic and calculation results.

### The Symbolic Pipeline
1. **Symbolization**: Each node in the `NodeRegistry` defines a `symbolizer` function. This function translates the node's current state and inputs into a symbolic **ASTNode** (Abstract Syntax Tree).
2. **Rendering**: The `FormulaRenderer.render()` utility recursively traverses the `ASTNode` and converts it into a valid LaTeX string.
3. **Display**: The `LatexView` component utilizes **KaTeX** to render the resulting string in the UI with sub-pixel precision.

### Key Logic (`FormulaRenderer.ts`)
- **Binary Operations**: Maps internal opCodes (`ADD`, `MUL`, `DIV`, `POW`) to LaTeX commands (`+`, `\cdot`, `\frac{}{}`, `^{}`).
- **Function Mapping**: Automatically formats standard functions like `\sin`, `\cos`, `\log`, and `\sqrt`.
- **Calculus Integration**: Dynamically formats differentiation and integration symbols for advanced calculus nodes.
- **Symbol Expansion**: Supports toggling between "Symbolic Mode" (showing variables like $x + y$) and "Evaluation Mode" (showing values like $5 + 3$).

## 2. LaTeX to Graph (Decomposition)
Beyond simple rendering, the system can "reverse engineer" a LaTeX expression into a functional node network.

### The Decomposition Pipeline
1. **Parsing**: The `parseLatexToGraph()` utility uses `tex-math-parser` to convert a raw LaTeX string into a MathJS-compatible AST.
2. **Translation**: The utility recursively traverses the AST and generates a series of `ADD_NODE` and `CONNECT` transactions.
3. **Injection**: These transactions are applied to the **Brain**, which instantly creates the corresponding visual nodes and edges on the canvas.

### Capabilities
- **Constants**: Creates `Number` nodes (`IO-01`) for numeric values.
- **Variables**: Creates $x$ or $y$ nodes for unknown symbols, automatically deduplicating repeated variables.
- **Complexity**: Can decompose nested fractions, powers, and trigonometric functions into a hierarchical graph structure.

## 3. Libraries Used
- **KaTeX**: High-performance LaTeX rendering for the web.
- **react-katex**: React wrapper for KaTeX components.
- **tex-math-parser**: A specialized parser for converting TeX mathematics into a structured object model for the engine.

---

> [!TIP]
> Use the **Result Node** (`OT-01`) to view any calculation result in high-fidelity LaTeX. You can toggle between `formula` and `latex` view modes to see the symbolic trace or the final formatted result.
