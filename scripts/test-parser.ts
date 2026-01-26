/**
 * Verification Script for LaTeX-to-Node Compiler
 * Run with: npx tsx scripts/test-parser.ts
 */

// Mocking some browser-only stuff if needed, but Parser.ts is mostly pure logic
import { compileLaTeX } from '../src/engine/Parser';

const testFormulas = [
    { name: "Basic Addition", latex: "a + b" },
    { name: "Fraction", latex: "\\frac{x}{y}" },
    { name: "Power", latex: "x^2" },
    { name: "Deduplication", latex: "\\sin(x) + \\cos(x)" },
    { name: "Nested Function", latex: "\\sin(x^2) + \\cos(y)" },
    { name: "Matrix", latex: "\\begin{matrix}1&2\\\\3&4\\end{matrix}" }
];

console.log("🚀 Starting LaTeX Parser Verification...\n");

testFormulas.forEach(test => {
    console.log(`--- Testing: ${test.name} (${test.latex}) ---`);
    const { nodes, edges } = compileLaTeX(test.latex);

    console.log(`Nodes Generated: ${nodes.length}`);
    nodes.forEach(n => console.log(`  [${n.type}] ID: ${n.id} Data: ${JSON.stringify(n.data)}`));

    console.log(`Edges Generated: ${edges.length}`);
    edges.forEach(e => console.log(`  ${e.source} [${e.sourceHandle}] -> ${e.target} [${e.targetHandle}]`));

    console.log("\n");
});

console.log("✅ Verification Complete.");
