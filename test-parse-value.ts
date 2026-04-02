import { GraphCodec } from './src/engine/GraphCodec';

const testCases = [
    { input: '"Line 1\\nLine 2"', expected: 'Line 1\nLine 2', name: 'Standard Escape' },
    { input: '"1. First\\n2. Second"', expected: '1. First\n2. Second', name: 'Numbered List' },
    { input: '"\\\"Quoted\\\""', expected: '"Quoted"', name: 'Escaped Quotes' },
    { input: '"\\\\Backslash"', expected: '\\Backslash', name: 'Escaped Backslash' },
    { input: '123', expected: 123, name: 'Number' },
    { input: 'true', expected: true, name: 'Boolean' }
];

console.log('--- GraphCodec.parseValue Testing ---');

let successCount = 0;
for (const tc of testCases) {
    const result = GraphCodec.parseValue(tc.input);
    if (result === tc.expected) {
        console.log(`[PASS] ${tc.name}`);
        successCount++;
    } else {
        console.log(`[FAIL] ${tc.name}`);
        console.log(`  Input:    ${JSON.stringify(tc.input)}`);
        console.log(`  Expected: ${JSON.stringify(tc.expected)}`);
        console.log(`  Actual:   ${JSON.stringify(result)}`);
    }
}

if (successCount === testCases.length) {
    console.log('\nALL TESTS PASSED!');
} else {
    console.log(`\n${testCases.length - successCount} TESTS FAILED.`);
    process.exit(1);
}
