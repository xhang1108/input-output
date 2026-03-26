/**
 * Defines the mapping between the IOGL 3.0 script syntax and internal node properties.
 */
export interface IOGLSchema {
  /** Internal property name mapping to the IOGL 'mode' selector (e.g. 'op', 'method'). */
  modeProperty?: string;
  /** Positional data schema: maps array indices to internal property names. */
  data?: string[] | Record<string, string[]>;
  /** Auxiliary properties that are appended at the end of the data array. */
  auxiliary?: string[];
}

/**
 * IOGL 3.0 Node Registry Manifest
 * Optimized for machine-reading and automated validation/parsing.
 */
export const IOGL_MANIFEST: Record<string, IOGLSchema> = {
  // --- 1. Input Family ---
  "IN-01": { data: ["value"] },
  "IN-02": { data: ["value", "min", "max", "step"] },
  "IN-03": { data: ["hex", "depth"] },
  "IN-04": { data: ["value"] },
  "IN-05": { modeProperty: "mode", data: ["value"] },
  "IN-06": { modeProperty: "val", data: ["precision"] },
  "IN-07": { data: ["array"] },
  "IN-08": { data: ["value"] },
  "IN-09": { data: ["code"] },
  "IN-10": { 
    modeProperty: "mode",
    auxiliary: ["isFloat", "rows", "cols", "min", "max", "mean", "stdDev", "lambda"]
  },

  // --- 2. Math Family ---
  "MA-01": { modeProperty: "op" },
  "MA-02": { modeProperty: "op" },
  "MA-03": { 
    modeProperty: "op", 
    data: { "LOGN": ["base"] } 
  },
  "MA-04": { modeProperty: "op" },
  "MA-05": { modeProperty: "op", data: ["precision"] },
  "MA-06": { modeProperty: "mixed" },
  "MA-07": { modeProperty: "op" },
  "MA-08": { modeProperty: "op" },

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
  "DT-01": { data: ["axis"] },
  "DT-02": { modeProperty: "indexMode" },
  "DT-03": { modeProperty: "mode" },
  "DT-04": { modeProperty: "mode" },
  "DT-05": { modeProperty: "op" },
  "DT-06": { modeProperty: "op" },

  // --- 5. Transform Family ---
  "TR-01": { modeProperty: "unit", data: ["customUnit"] },
  "TR-02": { modeProperty: "toBase" },
  "TR-03": { 
    modeProperty: "shape",
    data: {
      "Circle": ["radius"],
      "Quad": ["width", "height"],
      "Triangle": ["base", "height"]
    }
  },
  "TR-04": { modeProperty: "mode", data: ["min", "max", "density", "var1", "var2"] },
  "TR-05": { data: ["windowMode"] },
  "TR-06": { modeProperty: "op" },

  // --- 6. Logic / Output Family ---
  "LG-01": { modeProperty: "op" },
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
