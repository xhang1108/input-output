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
 * IOGL 1.0 Node Registry Manifest
 * Optimized for machine-reading and automated validation/parsing.
 */
export const IOGL_MANIFEST: Record<string, IOGLSchema> = {
  // --- 1. Input Family ---
  "IN-01": { data: ["value"], wrapPayload: true, payloadType: 'scalar' },
  "IN-02": { data: ["value", "min", "max", "step"], wrapPayload: true, payloadType: 'scalar' },
  "IN-03": { data: ["value", "depth"], wrapPayload: "value", payloadType: 'color' },
  "IN-04": { data: ["value"], wrapPayload: true, payloadType: 'string' },
  "IN-05": {
    modeProperty: "mode",
    data: {
      "Sticky": ["value"],
      "Momentary": []
    },
    wrapPayload: "value",
    payloadType: 'boolean'
  },
  "IN-06": { modeProperty: "val", data: ["precision"] },
  "IN-07": { data: ["array"], wrapPayload: "array", payloadType: 'array' },
  "IN-08": { data: ["array"], wrapPayload: "array", payloadType: 'array' },
  "IN-09": { data: ["code"] },
  "IN-10": {
    modeProperty: "mode",
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
  "MA-01": { modeProperty: "mode" },
  "MA-02": { modeProperty: "mode" },
  "MA-03": {
    modeProperty: "mode"
  },
  "MA-04": { modeProperty: "mode" },
  "MA-05": { modeProperty: "mode", data: ["precision"] },
  "MA-06": {
    modeProperty: "mixed",
    modeMapping: { "Mixed": true, "Regular": false }
  },
  "MA-07": { modeProperty: "mode" },
  "MA-08": { modeProperty: "mode" },

  // --- 3. Calculus Family ---
  "CL-01": { modeProperty: "variable", data: ["order"] },
  "CL-02": {
    modeProperty: "mode",
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
  "DT-03": { modeProperty: "mode", data: ["order"] },
  "DT-04": { modeProperty: "mode" },
  "DT-05": { modeProperty: "mode" },
  "DT-06": { modeProperty: "mode" },

  // --- 5. Transform Family ---
  "TR-01": {
    data: ["customUnit"],
    fixedData: { unit: "CUSTOM" }
  },
  "TR-02": { data: ["toBase"] },
  "TR-03": {
    modeProperty: "shape"
  },
  "TR-04": { modeProperty: "mode", data: ["min", "max", "density", "var1", "var2"] },
  "TR-05": { data: ["windowMode"] },
  "TR-06": { modeProperty: "mode" },

  // --- 6. Logic / Output Family ---
  "LG-01": {
    modeProperty: "mode",
    modeMapping: {
      "And": "AND", "Or": "OR", "Not": "NOT", "Xor": "XOR",
      "Equal": "EQ", "NotEqual": "NEQ", "Greater": "GT", "Less": "LT"
    }
  },
  "LG-02": {},
  "LG-03": {},
  "LG-04": { data: ["value"], wrapPayload: "value", payloadType: 'boolean' },
  "OT-01": { modeProperty: "viewMode", data: ["precision"] },
  "OT-02": {},
  "OT-03": { data: ["minX", "maxX", "points"] },
  "OT-04": {},

  // --- 7. Utility Family ---
  "UT-01": { modeProperty: "bgColor", data: ["markdown", "textSize"] },
  "UT-02": {}
};
