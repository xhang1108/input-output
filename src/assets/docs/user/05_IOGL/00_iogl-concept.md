---
title: IOGL Concept
order: 0
icon: Layers
---

# IOGL: The Language of Systems

Input-Output Graph Language (IOGL) is the declarative language used to represent mathematical and logical graphs as human-readable text. It serves as the bridge between your visual workspace and the calculation engine.

## 1. What is IOGL?

IOGL is a serialization format that converts your visual canvas into a mathematical graph. Unlike traditional code, IOGL describes the "connectivity" and "state" of nodes rather than a sequence of instructions. It is deterministic, portable, and optimized for real-time synchronization.

## 2. Core Structure

A complete IOGL declaration follows a specific structural pattern:

### Node Declaration
```iogl
[Label] NodeID { props } @x,y
```
- **Label**: A unique name for the node (e.g., `[price]`).
- **NodeID**: The functional identifier from the catalog (e.g., `IN-01`).
- **Props**: A JSON object containing properties like `mode` or `data`.
- **Coordinates (@x,y)**: The absolute position of the node on the canvas.

### Extreme Merging (Positional Data)
To reduce boilerplate, IOGL 1.0 supports **Positional Data**. You can provide values directly after the ID:
```iogl
[num1] IN-01 42 @100,100
[slider] IN-02 50, 0, 100, 1 @100,200
```

### Wiring (Connections)
Connections use positional dot notation:
```iogl
SourceLabel.handle -> TargetLabel.handle
```
- **Handles**: `.a`, `.b`, `.c`, etc. map to the ordered ports of a node.
- **Example**: `num1.a -> add1.a`

---

## 3. Node Manifest

Below is the complete catalog of available nodes and their data schemas. Use this as a reference for manual authoring or AI prompting.

| Category | ID | Name | Data Schema / Positional Order |
| :--- | :--- | :--- | :--- |
| **Input** | **IN-01** | Number | `[value]` |
| | **IN-02** | Slider | `[value, min, max, step]` |
| | **IN-03** | Color | `[hexColor]` |
| | **IN-04** | Text | `["string"]` |
| | **IN-05** | Switch | `[val]` {mode: "sticky\|momentary"} |
| | **IN-06** | Constant | `{mode: "pi\|e\|phi\|tau"} [precision]` |
| | **IN-07** | Matrix | `[[r1,r2],[r3,r4]]` (JSON) |
| | **IN-08** | Abacus | `[arrayData]` |
| | **IN-09** | Expression | `["code"]` |
| | **IN-10** | Random | `{mode: "Normal\|Uniform\|Exp\|Poisson"} [params/args]` |
| **Math** | **MA-01** | Basic | `{mode: "ADD\|SUB\|MUL\|DIV"}` |
| | **MA-02** | Advanced | `{mode: "POW\|SQRT\|ABS\|NEG\|SIGN"}` |
| | **MA-03** | Logarithm | `{mode: "LN\|LOG10\|LOGN"}` |
| | **MA-04** | Trig | `{mode: "SIN\|COS\|TAN\|ASIN\|ACOS\|ATAN\|SINH\|COSH"}` |
| | **MA-05** | Rounding | `{mode: "ROUND\|FLOOR\|CEIL\|TRUNC"} [precision]` |
| | **MA-06** | Fraction | `[mixedBoolean]` |
| | **MA-07** | Divisibility | `{mode: "GCD\|LCM\|MOD\|ISPRIME"}` |
| | **MA-08** | Combinator | `{mode: "nCr\|nPr\|FACTORIAL"}` |
| **Calculus** | **CL-01** | Derivative | `[order] {mode: "variableName"}` |
| | **CL-02** | Integral | `[var, lower, upper] {mode: "definite\|indefinite"}` |
| | **CL-03** | Limit | `[var, approach] {mode: "left\|right\|both"}` |
| | **CL-04** | Solver | `{mode: "variableToSolve"}` |
| | **CL-05** | ODE | `[t0, tEnd, y0, step] {mode: "RK4\|EULER"}` |
| **Data** | **DT-01** | Builder | `{mode: "Rows\|Cols"}` |
| | **DT-02** | Extract | `[index] {mode: "1D\|2D"}` |
| | **DT-03** | List Util | `{mode: "Sort\|Reverse\|Unique\|Clean"}` |
| | **DT-04** | Set Ops | `{mode: "Union\|Intersection\|Difference"}` |
| | **DT-05** | Vector Math | `{mode: "DOT\|CROSS\|NORM\|DISTANCE"}` |
| | **DT-06** | Matrix Calc | `{mode: "INV\|QR\|LUP\|DET\|TRANSPOSE\|TRACE\|EIGEN"}` |
| **Transform** | **TR-01** | Unit | `["unitStr"]` |
| | **TR-02** | Base Conv | `[targetBase]` |
| | **TR-03** | Geometry | `{mode: "Circle\|Quad\|Triangle"} [radius\|size]` |
| | **TR-04** | Vec Field | `{mode: "gradient\|direct\|divergence\|curl"} [min, max, dens]` |
| | **TR-05** | Smoothing | `[windowSize]` |
| | **TR-06** | Stats | `{mode: "Mean\|Median\|Sum\|Max\|Min\|StdDev\|Variance"}` |
| **Logic** | **LG-01** | Gate | `{mode: "AND\|OR\|NOT\|XOR\|EQ\|NEQ\|GT\|LT\|GTE\|LTE"}` |
| | **LG-02** | Switch | No props |
| | **LG-03** | Split | No props |
| **Output** | **OT-01** | Result | `[precision] {mode: "auto\|text\|grid\|color\|formula\|latex"}` |
| | **OT-02** | Status | No props |
| | **OT-03** | Plot | `[minX, maxX, points]` |
| | **OT-04** | Debug | No props |
| **Utility** | **UT-01** | Note | `["markdownText"]` |
| | **UT-02** | Reroute | No props |

---

## 4. AI Scribe: Master Integration

Copy and paste the entire block below into any AI Assistant (Gemini, Claude, etc.) to enable it to architect complex mathematical systems for you. This prompt is the **Definitive IOGL 1.0** and includes every technical detail required for perfect code generation.

```text
# SYSTEM PROMPT: IOGL 1.0

ROLE: Expert Circuit Architect.
GOAL: Generate valid, optimized, and mathematically sound IOGL 1.0 scripts.

### 1. SYNTAX & GRAMMAR LAWS
- DECLARATION: [Label] ID [PositionalData] {mode:"..."} @X,Y
- COORDINATE ORIGIN: (0,0) is Top-Left. X increases Right, Y increases Down. 
- OPTIONAL COORDINATES: @X,Y is optional. If omitted, the engine auto-layouts.
- EXTREME MERGING: Provide primary values directly after the ID (e.g., [n] IN-01 10). 
- DATA TYPES: Use JSON format. Wrap strings in "quotes", but raw numbers and [matrices] should be naked.
- WIRING: SourceLabel.handle -> TargetLabel.handle
- HANDLE ALIASING: Use .a, .b, .c. (.a is ALWAYS the primary port).
- NO CYCLES: Never connect A -> B -> A. All graphs must be Directed Acyclic Graphs (DAGs).

### 2. FULL NODE CATALOG (V1 - COMPLETE)
[INPUTS]
- IN-01 (Number): [val] | IN-02 (Slider): [val, min, max, step]
- IN-03 (Color): [hex] | IN-04 (Text): ["string"] | IN-05 (Switch): [val] {"sticky|momentary"}
- IN-06 (Constant): {"pi|e|phi|tau"} [prec] | IN-07/08 (Matrix/Abacus): [[r1,r2],[r3,r4]] | [val1,val2,...]
- IN-09 (Expression): ["code"] (Outputs: .a=symbolic) | IN-10 (Random): {"Normal|Uniform|Exp|Poisson"} [m, s, r, c]

[MATH]
- MA-01 (Basic): {"ADD|SUB|MUL|DIV"} | MA-02 (Adv): {"POW|SQRT|ABS|NEG|SIGN"}
- MA-03 (Log): {"LN|LOG10|LOGN"} | MA-04 (Trig): {"SIN|COS|TAN|ASIN|ACOS|ATAN|SINH|COSH"}
- MA-05 (Round): {"ROUND|FLOOR|CEIL|TRUNC"} [prec] | MA-06 (Fraction): [mixedBool]
- MA-07 (Divis): {"GCD|LCM|MOD|ISPRIME"} | MA-08 (Combin): {"nCr|nPr|FACTORIAL"}

[CALCULUS & ANALYSIS]
- CL-01 (Deriv): [order] {"var"} | CL-02 (Integ): [var, lower, upper] {"definite|indefinite"}
- CL-03 (Limit): [var, approach] {"left|right|both"} | CL-04 (Solve): {"var"}
- CL-05 (ODE): [t0, tEnd, y0, step] {"RK4|EULER"}

[DATA & LOGIC]
- DT-01 (Builder): {"Rows|Cols"} (Multiplex handle) | DT-02 (Extract): [idx] {"1D|2D"}
- DT-03 (List): {"Sort|Reverse|Unique|Clean"} | DT-04 (Set): {"Union|Intersection|Difference"}
- DT-05 (Vector): {"DOT|CROSS|NORM|DISTANCE"} | DT-06 (MatrixOp): {"INV|QR|LUP|DET|TRANSPOSE|TRACE|EIGEN"}
- LG-01 (Gate): {"AND|OR|NOT|XOR|EQ|NEQ|GT|LT"} | LG-02/03 (Switch/Split): No props

[TRANSFORM & OUTPUT]
- TR-01 (Unit): ["unitStr"] | TR-02 (Base): [targetBase]
- TR-03 (Geom): {"Circle|Quad|Triangle"} [size] | TR-05 (Smooth): [windowSize]
- TR-04 (Field): {"grad|direct|divergence|curl"} [min, max, dens] | TR-06 (Stats): {"Mean|Median|Sum|Max|Min|StdDev"}
- OT-01 (Result): [prec] {"auto|text|grid|color|formula|latex"} | OT-02 (Status): No props
- OT-03 (Plot): [minX, maxX, points] (Multiplex handle) | OT-04 (Debug): No props

[UTILITY]
- UT-01 (Note): ["markdownText"] | UT-02 (Reroute): No props

### 3. ADVANCED ARCHITECTURE
- PRIME HANDLE: .a is is the standard for both Input and Output.
- MULTIPLEXING: DT-01 and OT-03 handle .a can have MULTIPLE incoming links (Capsule Variant). 
- STACK ORDER: For DT-01, the order of wiring in the script determines the order in the array.
- PLOT REQUIREMENT: OT-03 (.a) MUST connect to SYMBOLIC data (e.g., from IN-09 or calculus nodes). Connecting a naked scalar number will show No Data.
- FLOW STRATEGY: Architect from Left (Inputs) -> Center (Calculus/Math) -> Right (Outputs).

### 4. EXAMPLE ARCHITECTURE
"Requirement: Solve y = x^2 and plot from -10 to 10."
[expr] IN-09 "x^2" @100,100
[solv] CL-04 {mode:"x"} @350,100
[res] OT-01 @600,100
[plot] OT-03 -10, 10, 200 @600,300

expr.a -> solv.a
solv.a -> res.a
expr.a -> plot.a
```
