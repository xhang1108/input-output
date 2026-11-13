---
title: IOGL Concept
order: 0
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
- **Coordinates (@x,y)**: The top-left position of the node. Root nodes use world (canvas) coordinates; children of a `FRAME` use parent-local coordinates (see §2.3).

### 2.1 Handling Spaces & Special Characters (Crucial)

> [!IMPORTANT]
> Since IOGL uses spaces to separate components (Label, ID, Props), any label containing **spaces** or **special characters** (math symbols, dashes, etc.) MUST be wrapped in **Square Brackets** `[]`.

| Scene | Invalid Syntax | Valid IOGL 1.0 Syntax |
| :--- | :--- | :--- |
| **Simple Name** | `price IN-01` | `price IN-01` (Brackets optional) |
| **With Space** | `my price IN-01` | `[my price] IN-01` |
| **Math Symbols** | `a + b MA-01` | `[a + b] MA-01` |
| **Numeric Start** | `1st_node IN-01` | `[1st_node] IN-01` |

> [!TIP]
> The **IOGL Encoder** automatically adds these brackets for you when exporting from the canvas. The **IOGL Parser** handles both bracketed and unbracketed labels seamlessly.

### Extreme Merging (Positional Data)
To reduce boilerplate, IOGL 1.0 supports **Positional Data**. You can provide values directly after the ID:
```iogl
[num1] IN-01 42 @100,100
[slider] IN-02 50, 0, 100, 1 @100,200
```

### 2.2 Dimension Shorthand
To reduce boilerplate for visual nodes like Sticky Notes, IOGL supports **Shorthand Dimensions**. Instead of verbose JSON objects, you can provide width and height as a comma-separated pair:
```iogl
[note] UT-01 "Title", 14 {200,100} @100,100
```
- **Syntax**: `{W,H}` inside the property braces.
- **Precision**: Dimensions are rounded to the nearest pixel during encoding.

### 2.3 Frames & Parenting

A **Frame** groups nodes visually without changing their mathematical meaning. Declare it with the `FRAME` keyword, a `{W,H}` size and a **world** `@x,y` (its top-left corner):

```iogl
[Group 1] FRAME {400,300} @100,100
[num] IN-01 42 {parent: "Group 1"} @20,20
[res] OT-01 {parent: "Group 1"} @20,120
```

- **`parent` is reserved**: its value is the frame's **label** (not its internal ID). Children keep their own `@x,y` as **parent-local** coordinates, exactly matching the stored node model.
- **Declaration order is free**: parent links are resolved after every declaration has been read, so the `FRAME` may appear after its children.
- **Consumed by the parser**: `parent` never leaks into node `data`; it becomes the node's `parentId`.
- **Single level only**: the parent must be a frame, that frame cannot itself have a `parent`, and a frame cannot be a child.
- **Invalid parents are rejected**: unknown label, non-frame parent, or nested frame produces a diagnostic and leaves the child unparented.
- **Export aborts on bad hierarchy**: if a node's parent is missing or is not a frame, the encoder throws instead of writing local coordinates as world coordinates.
- **Backward compatible**: graphs without frames emit no `parent` prop and remain byte-identical to IOGL 1.0 output.

### Wiring (Connections)
Connections use positional dot notation:
```iogl
SourceLabel.handle -> TargetLabel.handle
```
- **Handles**: `.a`, `.b`, `.c`, etc. map to the ordered ports of a node.
- **Example**: `num1.a -> add1.a`

### Handle Integrity (Ghost Link Prevention)
IOGL 1.0 enforces **Strict Handle Validation**. The handles available for a node can change based on its current `mode`.
- **Validation**: The system prevents invalid connections (type mismatch or topological cycles).
- **Naming Determinism**: 
    - Labels containing spaces or special symbols MUST be wrapped in `[]` (e.g., `[Node A]`).
    - The UI blocks empty strings, pure whitespace, and duplicate names.
If you reference a handle that doesn't exist for the current mode (e.g., trying to use `calc.b` while `calc` is in a single-output mode), the system will flag it as a **Ghost Link**.
- **Diagnostics**: Errors will appear in the system log, and the visual link will either disappear or show an error state to prevent invalid mathematical results.

---

### 3. Node Manifest

Below is the complete catalog of available nodes and their data schemas. Use this as a reference for manual authoring or AI prompting.

| ID | Name | Handles (In) | Handles (Out) | Data Schema / Positional Order |
| :--- | :--- | :--- | :--- | :--- |
| **IN-01** | **Number** | — | `out_a` | `[value]` |
| **IN-02** | **Slider** | — | `out_a` | `[val, min, max, step]` |
| **IN-03** | **Color** | — | `out_a` | `[hexColor]` |
| **IN-04** | **Text** | — | `out_a` | `["string"]` |
| **IN-05** | **Switch** | — | `out_a` | `{mode: "Sticky\|Momentary"}` |
| **IN-06** | **Constant** | — | `out_a` | `{mode: "pi\|e\|phi\|tau"}` |
| **IN-07** | **Array Input** | — | `out_a` | `[[r1,r2],[r3,r4]]` (JSON) |
| **IN-08** | **Abacus** | — | `out_a` | `[val1, val2, ...]` (JSON) |
| **IN-09** | **Expression** | — | `out_a` | `["code"]` |
| **IN-10** | **Random** | — | `out_a` | `{mode: "Normal\|Uniform\|..."}` |
| **IN-11** | **Timer** | — | `out_a` | `[init, current, step, interval] {running: true}` |
| **OT-01** | **Result** | `in_a` | — | `[precision] {mode: "auto\|grid\|..."}` |
| **OT-02** | **Status** | `in_a` | — | No props |
| **OT-03** | **Graph Plot** | `in_a` [capsule] | — | `[minX, maxX, points]` |
| **OT-04** | **Debug** | `in_a` | — | No props |
| **MA-01** | **Basic Math** | `in_a, in_b` | `out_a` | `{mode: "ADD\|SUB\|MUL\|DIV"}` |
| **MA-02** | **Advanced Math**| `in_a` | `out_a` | `{mode: "ABS\|NEG\|SIGN"}` |
| | | `in_a, in_b` | `out_a` | `{mode: "POW\|SQRT"}` |
| **MA-03** | **Logarithm** | `in_a` | `out_a` | `{mode: "LN\|LOG10"}` |
| | | `in_a, in_b` | `out_a` | `{mode: "LOGN"}` |
| **MA-04** | **Trig** | `in_a`, `in_b` | `out_a` | `{mode: "SIN\|COS\|TAN\|ATAN2\|..."}` |
| **MA-05** | **Rounding** | `in_a` | `out_a` | `{mode: "ROUND\|FLOOR\|..."}` |
| **MA-06** | **Fraction** | `in_a` | `out_a` | `{mode: "Mixed\|Regular"}` |
| **MA-07** | **Divisibility** | `in_a, in_b` | `out_a` | `{mode: "MOD\|GCD\|LCM"}` |
| | | `in_a` | `out_a` | `{mode: "ISPRIME"}` |
| **MA-08** | **Combinatorics**| `in_a, in_b` | `out_a` | `{mode: "NCR\|NPR\|STIRLING2"}` |
| **CL-01** | **Derivative** | `in_a` | `out_a` | `[order] {mode: "var"}` |
| **CL-02** | **Integral** | `in_a, in_b, in_c` | `out_a` | `{mode: "definite\|indefinite"}` |
| **CL-03** | **Limit** | `in_a, in_b` | `out_a` | `[var, approach] {mode: "both\|..."}` |
| **CL-04** | **Equation Solver**| `in_a` [capsule] | `out_a` | `{mode: "variableToSolve"}` |
| **CL-05** | **ODE Solver**| `in_a..in_e` | `out_a` | `[t0, tEnd, y0, step] {mode: "RK4"}` |
| **DT-01** | **Array Builder**| `in_a` [capsule] | `out_a` | `{mode: "Rows\|Cols"}` |
| **DT-02** | **Extract** | `in_a, in_b` | `out_a` | `[index] {mode: "1D\|2D"}` |
| **DT-03** | **List Utility** | `in_a` | `out_a` | `[order] {mode: "SORT_ASC\|REVERSE\|..."}` |
| **DT-04** | **Set Operations**| `in_a, in_b` | `out_a` | `{mode: "Union\|Intersection\|..."}` |
| **DT-05** | **Array Geometry**| `in_a, in_b` | `out_a` | `{mode: "DOT\|CROSS\|DISTANCE"}` |
| **DT-06** | **Array Calculus**| `in_a` | `out_a` | `{mode: "INV\|DET\|TRANS\|TRACE"}` |
| | | `in_a` | `out_a, out_b` | `{mode: "QR\|LU\|EIGEN"}` |
| | | `in_a` | `out_a..out_c`| `{mode: "LUP"}` |
| **TR-01** | **Unit** | `in_a` | `out_a` | `["customUnit"]` |
| **TR-02** | **Base Converter**| `in_a` | `out_a` | `[targetBase]` |
| **TR-03** | **Geometry** | `in_a` | `out_a` | `{mode: "Circle"}` |
| | | `in_a, in_b` | `out_a` | `{mode: "Quad\|Triangle"}` |
| **TR-04** | **Vector Field** | `in_a` | `out_a, out_b` | `{mode: "gradient"}` |
| | | `in_b, in_c` | `out_a, out_b` | `{mode: "direct"}` |
| | | `in_b, in_c` | `out_b` | `{mode: "divergence\|curl"}` |
| **TR-05** | **Smoothing** | `in_a` | `out_a` | `[windowSize]` |
| **TR-06** | **Statistics** | `in_a` [capsule] | `out_a` | `{mode: "Mean\|Median\|StdDev"}` |
| **LG-01** | **Logic Gate** | `in_a, in_b` | `out_a` | `{mode: "AND\|OR\|XNOR\|..."}` |
| **LG-02** | **Logic Switch** | `in_a` | `out_a` | No props |
| **LG-03** | **Logic Splitter**| `in_a` | `out_a` | No props |
| **UT-01** | **Sticky Note** | — | — | `["markdown", "textSize"] {W,H}` |
| **UT-02** | **Reroute** | `in_a` | `out_a` | No props |
| **UT-03** | **Concatenate** | `in_a` [capsule] | `out_a` | `["delimiter"]` |
| **FRAME** | **Frame** | — | — | `{W,H}` world `@x,y`; children use `{parent: "FrameLabel"}` with local `@x,y` |

---

## 4. AI Scribe: Master Integration

Copy and paste the entire block below into any AI Assistant (Gemini, Claude, etc.) to enable it to architect complex mathematical systems for you. This prompt is the **Definitive IOGL 1.0** and includes every technical detail required for perfect code generation.

```text
# SYSTEM PROMPT: IOGL 1.0

ROLE: Expert Circuit Architect.
GOAL: Generate valid, optimized, and mathematically sound IOGL 1.0 scripts.

### 1. SYNTAX & GRAMMAR LAWS
- DECLARATION: [Label] ID [PositionalData] {mode:"...", prop:val} @X,Y
- DIMENSION SHORTHAND: {W,H} inside props for UT-01 (e.g., [n] UT-01 {200,100}).
- COORDINATE ORIGIN: (0,0) is Top-Left. X increases Right, Y increases Down.
- FRAME: [Label] FRAME {W,H} @X,Y uses a world top-left position. Children add {parent:"FrameLabel"} and keep a LOCAL @X,Y. Single level only.
- EXTREME MERGING: Provide primary values directly after the ID (e.g., [n] IN-01 10). 
- DATA TYPES: Use JSON format. Wrap strings in "quotes", but raw numbers and [arrays] should be naked.
- WIRING: [SourceLabel] SourceHandle -> [TargetLabel] TargetHandle
- HANDLE ALIASING: Use .a, .b, .c. (.a is ALWAYS the primary port).
- HANDLE INTEGRITY: Handles are MODE-DEPENDENT. Referencing a handle not supported by the current mode results in a "Ghost Link" (error).
- NO CYCLES: Never connect A -> B -> A. All graphs must be Directed Acyclic Graphs (DAGs).

### 2. FULL NODE CATALOG (V1.0 - 47 NODES)
[INPUT]
- IN-01(Number): [val] | IN-02(Slider): [val,min,max,step] | IN-03(Color): [hex] | IN-04(Text): ["str"]
- IN-05(Switch): {"Sticky|Momentary"} [val] | IN-06(Constant): {"pi|e|phi|tau"} | IN-07(Array): [[r1,r2],[r3,r4]]
- IN-08(Abacus): [list] | IN-09(Expr): ["code"] | IN-10(Random): {"Normal|Uniform|Exponential|Poisson"}
- IN-11(Timer): [init, current, step, interval] {running:bool}

[MATH]
- MA-01(Basic): {"ADD|SUB|MUL|DIV"} (.a, .b)
- MA-02(Adv): {"ABS|NEG|SIGN"} (.a) | {"POW|SQRT"} (.a, .b)
- MA-03(Log): {"LN|LOG10"} (.a) | {"LOGN"} (.a, .b)
- MA-04(Trig): {"SIN|COS|TAN|ATAN2|SINH|COSH"} (.a, .b)
- MA-05(Rounding): {"ROUND|FLOOR|CEIL|FIX"} (.a) [prec]
- MA-06(Fraction): {"Mixed|Regular"} (.a)
- MA-07(Div): {"MOD|GCD|LCM"} (.a, .b) | {"ISPRIME"} (.a)
- MA-08(Combinatorics): {"NCR|NPR|STIRLING2"} (.a, .b)

[CALCULUS]
- CL-01(Derivative): [order] {"variable"} (.a)
- CL-02(Integral): {"definite|indefinite"} {variable, lower, upper} (.a, .b, .c)
- CL-03(Limit): [direction] {variable, approach} (.a, .b)
- CL-04(Eq Solver): {variable} (.a [capsule])
- CL-05(ODE Solver): [t0, tEnd, y0, step] {method:"RK4"} (.a..in_e)

[DATA]
- DT-01(Builder): {"Rows|Cols"} (.a [capsule])
- DT-02(Extract): [index] {"1D|2D"} (.a, .b)
- DT-03(List Utility): [order] {"SORT_ASC|SORT_DESC|REVERSE|UNIQUE|CLEAN"} (.a)
- DT-04(Set Ops): {"Union|Intersection|Difference"} (.a, .b)
- DT-05(Array Geom): {"DOT|CROSS|NORM|DISTANCE"} (.a, .b)
- DT-06(Array Calc): {"INV|DET|TRANSPOSE|TRACE"} (.a) | {"QR|LU|EIGEN"} (.a -> .a,.b) | {"LUP"} (.a -> .a..out_c)

[TRANSFORM]
- TR-01(Unit): ["unit"] (.a)
- TR-02(Base Conv): [toBase] (.a)
- TR-03(Geometry): {"Circle"} (.a) | {"Quad|Triangle"} (.a, .b)
- TR-04(Vector Field): {"gradient"} (.a -> .a,.b) | {"direct"} (.b,.c -> .a,.b) | {"divergence|curl"} (.b,.c -> .b)
- TR-05(Smoothing): [window] (.a)
- TR-06(Statistics): {"Mean|Median|StdDev|Var|Sum|Max|Min"} (.a [capsule])

[LOGIC]
- LG-01(Logic Gate): {"AND|OR|NOT|NAND|NOR|XOR|XNOR|EQ|NEQ|GT|LT|GTE|LTE"} (.a, .b)
- LG-02(Logic Switch): (.a, .b, .c) | LG-03(Logic Splitter): (.a -> .a,.b)

[OUTPUT & UTIL]
- OT-01(Result): [prec] {"auto|grid|formula|latex"} (.a)
- OT-02(Status): (.a) | OT-03(Graph Plot): [minX, maxX, points] (.a [capsule]) | OT-04(Debug): (.a)
- UT-01(Sticky Note): ["markdown", "size"] {W,H}
- UT-02(Reroute): (.a -> .a)
- UT-03(Concatenate): ["delimiter"] (.a [capsule])
- FRAME(Frame): {W,H} world @X,Y; children use {parent:"FrameLabel"} with local coordinates (single level)

### 3. EXAMPLE ARCHITECTURE
"Requirement: Solve y = x^2 and plot from -10 to 10."

```iogl
[base expr] IN-09 "x^2" @0,0
[solver] CL-04 {variable:"x"} @300,0
[res] OT-01 @600,0
[plot] OT-03 -10,10,200 @600,300

[base expr].a -> [solver].a
[solver].a -> [res].a
[base expr].a -> [plot].a
```
```
