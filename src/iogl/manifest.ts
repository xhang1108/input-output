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

/**
 * IOGL 1.0 Node Registry Manifest
 * Optimized for machine-reading and automated validation/parsing.
 */
export const IOGL_MANIFEST: Record<string, IOGLSchema> = {
  // --- 1. Input Family ---
  "IN-01": SCALAR_INPUT,
  "IN-02": { data: ["value", "min", "max", "step"], wrapPayload: true, payloadType: 'scalar' },
  "IN-03": COLOR_INPUT,
  "IN-04": STRING_INPUT,
  "IN-05": {
    ...MODE_ONLY,
    data: {
      "Sticky": ["value"],
      "Momentary": []
    },
    wrapPayload: "value",
    payloadType: 'boolean'
  },
  "IN-06": { modeProperty: "val", data: ["precision"] },
  "IN-07": ARRAY_INPUT,
  "IN-08": ARRAY_INPUT,
  "IN-09": { data: ["code"] },
  "IN-10": {
    ...MODE_ONLY,
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
  "MA-01": MODE_ONLY,
  "MA-02": MODE_ONLY,
  "MA-03": MODE_ONLY,
  "MA-04": MODE_ONLY,
  "MA-05": { ...MODE_ONLY, data: ["precision"] },
  "MA-06": {
    modeProperty: "mixed",
    modeMapping: { "Mixed": true, "Regular": false }
  },
  "MA-07": MODE_ONLY,
  "MA-08": MODE_ONLY,

  // --- 3. Calculus Family ---
  "CL-01": { modeProperty: "variable", data: ["order"] },
  "CL-02": {
    ...MODE_ONLY,
    data: {
      "indefinite": ["variable"],
      "definite": ["variable", "lower", "upper"]
    }
  },
  "CL-03": { modeProperty: "direction", data: ["variable", "approach"] },
  "CL-04": { modeProperty: "variable" },
  "CL-05": { modeProperty: "method", data: ["t0", "tEnd", "y0", "stepSize"] },

  // --- 4. Data Family ---
  "DT-01": {
    modeProperty: "axis",
    modeMapping: { "Rows": 0, "Cols": 1 }
  },
  "DT-02": { modeProperty: "indexMode", data: ["index"] },
  "DT-03": { ...MODE_ONLY, data: ["order"] },
  "DT-04": MODE_ONLY,
  "DT-05": MODE_ONLY,
  "DT-06": MODE_ONLY,

  // --- 5. Transform Family ---
  "TR-01": {
    data: ["customUnit"],
    fixedData: { unit: "CUSTOM" }
  },
  "TR-02": { data: ["toBase"] },
  "TR-03": { modeProperty: "shape" },
  "TR-04": { ...MODE_ONLY, data: ["min", "max", "density", "var1", "var2"] },
  "TR-05": { data: ["windowMode"] },
  "TR-06": MODE_ONLY,

  // --- 6. Logic / Output Family ---
  "LG-01": {
    ...MODE_ONLY,
    modeMapping: {
      "And": "AND", "Or": "OR", "Not": "NOT", "Xor": "XOR",
      "Nand": "NAND", "Nor": "NOR", "Xnor": "XNOR",
      "Equal": "EQ", "NotEqual": "NEQ", "Greater": "GT", "Less": "LT"
    }
  },
  "LG-02": {},
  "LG-03": {},
  "OT-01": { modeProperty: "viewMode", data: ["precision"] },
  "OT-02": {},
  "OT-03": { data: ["minX", "maxX", "points"] },
  "OT-04": {},

  // --- 7. Utility Family ---
  "UT-01": { modeProperty: "bgColor", data: ["markdown", "textSize"] },
  "UT-02": {}
};
