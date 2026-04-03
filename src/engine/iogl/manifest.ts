/**
 * Defines the mapping between the IOGL 1.0 script syntax and internal node properties.
 */
export interface IOGLSchema {
  /** Internal property name mapping to the IOGL 'mode' selector (e.g. 'op', 'method'). */
  modeProperty?: string;
  /** Mapping for values in the 'mode' selector. (e.g. {"Rows": 0, "Cols": 1}) */
  modeMapping?: Record<string, any>;
  /** Positional data schema: maps array indices to internal property names. */
  data?: string[] | Record<string, string[]>;
  /** Auxiliary properties that are appended at the end of the data array. */
  auxiliary?: string[];
  /** If true, the primary 'value' property will be wrapped in a NodePayload. If string, wraps that specific property. */
  wrapPayload?: boolean | string;
  /** The type of payload to wrap as (e.g. 'scalar', 'array'). Defaults to 'scalar'. */
  payloadType?: 'scalar' | 'array' | 'color' | 'string' | 'boolean';
  /** Hidden properties to be injected regardless of IOGL input. */
  fixedData?: Record<string, any>;
  /** Valid input handle IDs. Can be a fixed list or a mapping per mode. */
  inputs?: string[] | Record<string, string[]>;
  /** Valid output handle IDs. Can be a fixed list or a mapping per mode. */
  outputs?: string[] | Record<string, string[]>;
}

/**
 * IOGL Schema Templates for De-duplication.
 */
const MODE_ONLY: IOGLSchema = { modeProperty: "mode" };
const SCALAR_INPUT: IOGLSchema = { data: ["value"], wrapPayload: true, payloadType: 'scalar' };
const STRING_INPUT: IOGLSchema = { data: ["value"], wrapPayload: true, payloadType: 'string' };
const BOOLEAN_INPUT: IOGLSchema = { data: ["value"], wrapPayload: "value", payloadType: 'boolean' };
const ARRAY_INPUT: IOGLSchema = { data: ["array"], wrapPayload: "array", payloadType: 'array' };
const COLOR_INPUT: IOGLSchema = { data: ["value", "depth"], wrapPayload: "value", payloadType: 'color' };

const SINGLE_OUT: IOGLSchema = { outputs: ["out_a"] };
const SINGLE_IN: IOGLSchema = { inputs: ["in_a", "in_b"] };

/**
 * IOGL 1.0 Node Registry Manifest
 * Optimized for machine-reading and automated validation/parsing.
 */
export const IOGL_MANIFEST: Record<string, IOGLSchema> = {
  // --- 1. Input Family ---
  "IN-01": { ...SCALAR_INPUT, ...SINGLE_OUT },
  "IN-02": { ...SINGLE_OUT, data: ["value", "min", "max", "step"], wrapPayload: true, payloadType: 'scalar' },
  "IN-03": { ...COLOR_INPUT, ...SINGLE_OUT },
  "IN-04": { ...STRING_INPUT, ...SINGLE_OUT },
  "IN-05": {
    ...MODE_ONLY,
    ...SINGLE_OUT,
    data: {
      "Sticky": ["value"],
      "Momentary": []
    },
    wrapPayload: "value",
    payloadType: 'boolean'
  },
  "IN-06": { ...SINGLE_OUT, modeProperty: "val", data: ["precision"] },
  "IN-07": { ...ARRAY_INPUT, ...SINGLE_OUT },
  "IN-08": { ...ARRAY_INPUT, ...SINGLE_OUT },
  "IN-09": { ...SINGLE_OUT, data: ["code"] },
  "IN-10": {
    ...MODE_ONLY,
    ...SINGLE_OUT,
    data: {
      "Uniform": ["min", "max", "rows", "cols"],
      "Uniform:Float": ["min", "max", "rows", "cols"],
      "Uniform:Int": ["min", "max", "rows", "cols"],
      "Normal": ["mean", "stdDev", "rows", "cols"],
      "Normal:Float": ["mean", "stdDev", "rows", "cols"],
      "Normal:Int": ["mean", "stdDev", "rows", "cols"],
      "Exponential": ["lambda", "rows", "cols"],
      "Poisson": ["lambda", "rows", "cols"]
    },
    auxiliary: ["isFloat"]
  },

  // --- 2. Math Family ---
  "MA-01": { ...MODE_ONLY, ...SINGLE_OUT, inputs: ["in_a", "in_b"] },
  "MA-02": {
    ...MODE_ONLY,
    ...SINGLE_OUT,
    inputs: {
      "ABS": ["in_a"],
      "NEG": ["in_a"],
      "SIGN": ["in_a"],
      "POW": ["in_a", "in_b"],
      "SQRT": ["in_a", "in_b"]
    }
  },
  "MA-03": {
    ...MODE_ONLY,
    ...SINGLE_OUT,
    inputs: {
      "LN": ["in_a"],
      "LOG10": ["in_a"],
      "LOGN": ["in_a", "in_b"]
    }
  },
  "MA-04": { ...MODE_ONLY, ...SINGLE_OUT },
  "MA-05": { ...MODE_ONLY, ...SINGLE_OUT, data: ["precision"] },
  "MA-06": {
    ...SINGLE_OUT,
    modeProperty: "mixed",
    modeMapping: { "Mixed": true, "Regular": false }
  },
  "MA-07": {
    ...MODE_ONLY,
    ...SINGLE_OUT,
    inputs: {
      "GCD": ["in_a", "in_b"],
      "LCM": ["in_a", "in_b"],
      "MOD": ["in_a", "in_b"],
      "ISPRIME": ["in_a"]
    }
  },
  "MA-08": { ...MODE_ONLY, ...SINGLE_OUT },

  // --- 3. Calculus Family ---
  "CL-01": { ...SINGLE_OUT, modeProperty: "variable", data: ["order"] },
  "CL-02": {
    ...MODE_ONLY,
    ...SINGLE_OUT,
    data: {
      "indefinite": ["variable"],
      "definite": ["variable", "lower", "upper"]
    },
    inputs: {
      "indefinite": ["in_a", "in_b", "in_c"],
      "definite": ["in_a", "in_b", "in_c"]
    }
  },
  "CL-03": { ...SINGLE_OUT, modeProperty: "direction", data: ["variable", "approach"] },
  "CL-04": { ...SINGLE_OUT, modeProperty: "variable" },
  "CL-05": { ...SINGLE_OUT, modeProperty: "method", data: ["t0", "tEnd", "y0", "stepSize"] },

  // --- 4. Data Family ---
  "DT-01": {
    modeProperty: "axis",
    modeMapping: { "Rows": 0, "Cols": 1 }
  },
  "DT-02": { modeProperty: "indexMode", data: ["index"] },
  "DT-03": { ...MODE_ONLY, data: ["order"] },
  "DT-04": MODE_ONLY,
  "DT-05": MODE_ONLY,
  "DT-06": {
    ...MODE_ONLY,
    outputs: {
      "INV": ["out_a"],
      "DET": ["out_a"],
      "TRANSPOSE": ["out_a"],
      "TRACE": ["out_a"],
      "QR": ["out_a", "out_b"],
      "LU": ["out_a", "out_b"],
      "LUP": ["out_a", "out_b", "out_c"],
      "EIGEN": ["out_a", "out_b"]
    }
  },

  // --- 5. Transform Family ---
  "TR-01": {
    ...SINGLE_OUT,
    data: ["customUnit"],
    fixedData: { unit: "CUSTOM" }
  },
  "TR-02": { ...SINGLE_OUT, data: ["toBase"] },
  "TR-03": {
    ...SINGLE_OUT,
    modeProperty: "shape",
    inputs: {
      "Circle": ["in_a"],
      "Quad": ["in_a", "in_b"],
      "Triangle": ["in_a", "in_b"]
    }
  },
  "TR-04": {
    ...MODE_ONLY,
    data: ["min", "max", "density", "var1", "var2"],
    inputs: {
      "gradient": ["in_a"],
      "direct": ["in_b", "in_c"],
      "divergence": ["in_b", "in_c"],
      "curl": ["in_b", "in_c"]
    },
    outputs: {
      "gradient": ["out_a", "out_b"],
      "direct": ["out_a", "out_b"],
      "divergence": ["out_b"],
      "curl": ["out_b"]
    }
  },
  "TR-05": { ...SINGLE_OUT, data: ["windowMode"] },
  "TR-06": { ...MODE_ONLY, ...SINGLE_OUT },

  // --- 6. Logic / Output Family ---
  "LG-01": {
    ...MODE_ONLY,
    modeMapping: {
      "And": "AND", "Or": "OR", "Not": "NOT", "Xor": "XOR",
      "Nand": "NAND", "Nor": "NOR", "Xnor": "XNOR",
      "Equal": "EQ", "NotEqual": "NEQ", "Greater": "GT", "Less": "LT"
    }
  },
  "LG-02": { inputs: ["in_a", "in_b", "in_c"], outputs: ["out_a"] },
  "LG-03": { inputs: ["in_a", "in_b"], outputs: ["out_a", "out_b"] },
  "OT-01": { ...SINGLE_IN, modeProperty: "viewMode", data: ["precision"] },
  "OT-02": { ...SINGLE_IN },
  "OT-03": { ...SINGLE_IN, data: ["minX", "maxX", "points"] },
  "OT-04": { ...SINGLE_IN },

  // --- 7. Utility Family ---
  "UT-01": { modeProperty: "bgColor", data: ["markdown", "textSize"], auxiliary: ["width", "height"] },
  "UT-02": { ...SINGLE_IN, ...SINGLE_OUT },
  "UT-03": { inputs: ["in_a"], ...SINGLE_OUT, data: ["delimiter"] }
};
