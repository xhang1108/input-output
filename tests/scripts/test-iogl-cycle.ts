
import { GraphCodec } from '../../src/engine/GraphCodec';

const originalMarkdown = 'Line 1\nLine 2\n- Item 1\n1. Ordered\n"Quoted"\n\\ Backslash\n\\n Literal newline sequence';
const mockGraph = {
    nodes: [
        {
            id: 'node-1',
            type: 'UT-01',
            position: { x: 100, y: 100 },
            data: { 
                markdown: originalMarkdown,
                label: 'Sticky Note'
            }
        }
    ],
    edges: []
};

console.log('--- Original ---');
console.log(originalMarkdown);

const encoded = GraphCodec.encode(mockGraph as any);
console.log('\n--- Encoded IOGL ---');
console.log(encoded);

const decoded = GraphCodec.parse(encoded);
const decodedNode = decoded.graph.nodes[0] as any;
const decodedMarkdown = decodedNode.data.markdown;

console.log('\n--- Decoded ---');
console.log(decodedMarkdown);

if (decodedMarkdown === originalMarkdown) {
    console.log('\n SUCCESS: Decoded matches Original');
} else {
    console.log('\n FAILURE: Decoded does NOT match Original');
    console.log('Original Length:', originalMarkdown.length);
    console.log('Decoded Length:', decodedMarkdown.length);
    
    for (let i = 0; i < Math.max(originalMarkdown.length, (decodedMarkdown as string).length); i++) {
        if (originalMarkdown[i] !== (decodedMarkdown as string)[i]) {
            console.log(`Mismatch at index ${i}: Original[${originalMarkdown[i]?.charCodeAt(0)}] vs Decoded[${(decodedMarkdown as string)[i]?.charCodeAt(0)}]`);
            console.log(`Context: Original[${originalMarkdown.substring(i-5, i+5)}] vs Decoded[${(decodedMarkdown as string).substring(i-5, i+5)}]`);
            break;
        }
    }
}

// Additional Test: Literal \n in IOGL file (manually crafted)
console.log('\n--- Test: Single backslash-n in IOGL string ---');
const manualIogl = '[Test] UT-01 "A\\nB" @0,0';
const manualDecoded = GraphCodec.parse(manualIogl).graph.nodes[0].data.markdown;
if (manualDecoded === 'A\nB') {
    console.log('SUCCESS: "A\\nB" became real newline');
} else {
    console.log('FAILURE: "A\\nB" became:', JSON.stringify(manualDecoded));
}

// Additional Test: Double backslash-n in IOGL string
console.log('\n--- Test: Double backslash-n in IOGL string ---');
const manualIogl2 = '[Test] UT-01 "A\\\\nB" @0,0';
const manualDecoded2 = GraphCodec.parse(manualIogl2).graph.nodes[0].data.markdown;
if (manualDecoded2 === 'A\\nB') {
    console.log('SUCCESS: "A\\\\nB" became literal \\n');
} else {
    console.log('FAILURE: "A\\\\nB" became:', JSON.stringify(manualDecoded2));
}

