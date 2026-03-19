// This file is auto-generated. Do not edit manually.
export interface DocEntry {
  id: string;
  modes: string[];
}

export const DOC_REGISTRY: DocEntry[] = [
  {
    "id": "00_mathengine",
    "modes": [
      "developer"
    ]
  },
  {
    "id": "00_quick-start",
    "modes": [
      "user"
    ]
  },
  {
    "id": "01_contributing",
    "modes": [
      "developer"
    ]
  },
  {
    "id": "03_faq",
    "modes": [
      "user"
    ]
  },
  {
    "id": "calculus-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "custom-nodes",
    "modes": [
      "developer"
    ]
  },
  {
    "id": "data-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "data-symbology",
    "modes": [
      "user"
    ]
  },
  {
    "id": "evaluator-internals",
    "modes": [
      "developer"
    ]
  },
  {
    "id": "input-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "interaction-control",
    "modes": [
      "user"
    ]
  },
  {
    "id": "iogl-protocol",
    "modes": [
      "user"
    ]
  },
  {
    "id": "logic-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "math-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "output-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "shortcuts",
    "modes": [
      "user"
    ]
  },
  {
    "id": "system-architecture",
    "modes": [
      "developer"
    ]
  },
  {
    "id": "transform-nodes",
    "modes": [
      "user"
    ]
  },
  {
    "id": "Update_Log",
    "modes": [
      "shared",
      "user",
      "developer"
    ]
  },
  {
    "id": "utility-nodes",
    "modes": [
      "user"
    ]
  }
];
export const NODE_DOC_MAP: Record<string, string> = {
  "CL-01": "calculus-nodes",
  "CL-02": "calculus-nodes",
  "CL-03": "calculus-nodes",
  "CL-04": "calculus-nodes",
  "CL-05": "calculus-nodes",
  "DT-01": "data-nodes",
  "DT-02": "data-nodes",
  "DT-03": "data-nodes",
  "DT-04": "data-nodes",
  "DT-05": "data-nodes",
  "DT-06": "data-nodes",
  "DT-07": "data-nodes",
  "IN-01": "input-nodes",
  "IN-02": "input-nodes",
  "IN-03": "input-nodes",
  "IN-04": "input-nodes",
  "IN-05": "input-nodes",
  "IN-06": "input-nodes",
  "IN-07": "input-nodes",
  "IN-08": "input-nodes",
  "IN-09": "input-nodes",
  "IN-10": "input-nodes",
  "LG-01": "logic-nodes",
  "LG-02": "logic-nodes",
  "LG-03": "logic-nodes",
  "MA-01": "math-nodes",
  "MA-02": "math-nodes",
  "MA-03": "math-nodes",
  "MA-04": "math-nodes",
  "MA-05": "math-nodes",
  "MA-06": "math-nodes",
  "MA-07": "math-nodes",
  "MA-08": "math-nodes",
  "OT-01": "output-nodes",
  "OT-02": "output-nodes",
  "OT-03": "output-nodes",
  "OT-04": "output-nodes",
  "TR-01": "transform-nodes",
  "TR-02": "transform-nodes",
  "TR-03": "transform-nodes",
  "TR-04": "transform-nodes",
  "TR-05": "transform-nodes",
  "TR-06": "transform-nodes",
  "UT-01": "utility-nodes",
  "UT-02": "utility-nodes"
};

export function getDocInfo(nodeType: string, opToken?: string): { sectionId: string, anchor: string } | undefined {
  if (NODE_DOC_MAP[nodeType]) {
      return { sectionId: NODE_DOC_MAP[nodeType], anchor: nodeType };
  }
  // Fallback map exact opTokens if no nodeType matches
  if (opToken) {
      const slug = opToken.replace(/:/g, '-');
      if (DOC_REGISTRY.find(d => d.id === slug)) {
          return { sectionId: slug, anchor: slug };
      }
  }
  return undefined;
}

export function hasDocForToken(nodeType: string, opToken?: string): boolean {
  return !!getDocInfo(nodeType, opToken);
}
