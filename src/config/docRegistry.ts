// This file is auto-generated. Do not edit manually.
export interface DocEntry {
  id: string;
  modes: string[];
}

export const DOC_REGISTRY: DocEntry[] = [
  {
    "id": "body-metaphor",
    "modes": [
      "engineer"
    ]
  },
  {
    "id": "brain-architecture",
    "modes": [
      "engineer"
    ]
  },
  {
    "id": "calculus-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "data-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "data-symbology",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "evaluator-internals",
    "modes": [
      "engineer"
    ]
  },
  {
    "id": "input-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "interaction-physics",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "iogl-protocol",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "logic-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "math-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "node-forger",
    "modes": [
      "engineer"
    ]
  },
  {
    "id": "output-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "performance-cycles",
    "modes": [
      "engineer"
    ]
  },
  {
    "id": "shortcuts",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "transaction-system",
    "modes": [
      "engineer"
    ]
  },
  {
    "id": "transform-nodes",
    "modes": [
      "operator"
    ]
  },
  {
    "id": "utility-nodes",
    "modes": [
      "operator"
    ]
  }
];
export const NODE_DOC_MAP: Record<string, string> = {
  "CL-01": "calculus-nodes",
  "CL-02": "calculus-nodes",
  "CL-04": "calculus-nodes",
  "DT-01": "data-nodes",
  "DT-02": "data-nodes",
  "DT-05": "data-nodes",
  "IN-01": "input-nodes",
  "IN-02": "input-nodes",
  "IN-07": "input-nodes",
  "LG-01": "logic-nodes",
  "LG-02": "logic-nodes",
  "MA-01": "math-nodes",
  "MA-02": "math-nodes",
  "OT-01": "output-nodes",
  "OT-03": "output-nodes",
  "OT-02": "output-nodes",
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
