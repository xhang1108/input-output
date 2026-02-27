
import { generateNodeId, generateEdgeId } from '../src/utils/idGenerator';

const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
const excluded = ['0', 'O', '1', 'I', 'l'];

console.log('--- Verification: Optimized ID Generator ---');

function verify(id: string, name: string) {
    const hash = id.split('_').pop() || '';
    if (hash.length !== 8) {
        console.error(`FAIL [${name}]: Length is ${hash.length}, expected 8. ID: ${id}`);
        return false;
    }

    for (const char of hash) {
        if (!alphabet.includes(char)) {
            console.error(`FAIL [${name}]: Found invalid character '${char}' in ID: ${id}`);
            return false;
        }
    }

    console.log(`PASS [${name}]: ${id}`);
    return true;
}

let allPass = true;
for (let i = 0; i < 100; i++) {
    if (!verify(generateNodeId('MathNode'), `NodeID_${i}`)) allPass = false;
    if (!verify(generateEdgeId(), `EdgeID_${i}`)) allPass = false;
}

if (allPass) {
    console.log('\n✅ All IDs passed validation (no ambiguous characters, correct length).');
} else {
    console.log('\n❌ Validation failed.');
}
