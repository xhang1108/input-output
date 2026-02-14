
import { PayloadUtils } from '../utils/PayloadUtils';
import { NodeRegistry } from '../engine/NodeRegistry';
import { DataType } from '../types/payload';

console.log('--- Verifying Payload Architecture ---');

// 1. Test PayloadUtils.mergeUnits
console.log('\n[Test 1] Unit Merging');
const cases = [
    { a: 'm', b: 'm', op: 'ADD', expected: 'm' },
    { a: 'm', b: 's', op: 'ADD', expected: 'm|s' }, // Mismatch
    { a: 'm', b: 's', op: 'DIV', expected: 'm/s' },
    { a: 'm', b: 'm', op: 'MUL', expected: 'm*m' },
];

cases.forEach(c => {
    const result = PayloadUtils.mergeUnits(c.a, c.b, c.op as any);
    const pass = result === c.expected;
    console.log(`  ${c.a} ${c.op} ${c.b} -> ${result} [${pass ? 'PASS' : 'FAIL'}]`);
});

// 2. Test MathNode Evaluation
console.log('\n[Test 2] MathNode Evaluation');
const mathNodeStub = { id: 'test-math', type: 'MA-01', value: PayloadUtils.createScalar(0), isDirty: true, data: { op: 'ADD' } };

const inputA = PayloadUtils.createScalar(5, 'kg');
const inputB = PayloadUtils.createScalar(10, 'kg');
const inputs = { 'in_a': inputA, 'in_b': inputB };

const output = NodeRegistry.evaluate(mathNodeStub, inputs);

console.log('Output Payload:', JSON.stringify(output, null, 2));

if (output.value === 15 && output.meta?.unit === 'kg') {
    console.log('  [PASS] 5kg + 10kg = 15kg');
} else {
    console.log('  [FAIL] MathNode Evaluation');
}

// 3. Test Symbol Generation
console.log('\n[Test 3] AST Generation');
if (output.symbol && output.symbol.type === 'BinaryExpression') {
    console.log('  [PASS] Symbol generated:', output.symbol.operator);
} else {
    console.log('  [FAIL] No Symbol generated');
}

// 4. Test String Parsing
console.log('\n[Test 4] String Parsing');
const parseCases = [
    { input: "5", expectedVal: 5, expectedUnit: undefined },
    { input: "5kg", expectedVal: 5, expectedUnit: "kg" },
    { input: "10.5 m/s", expectedVal: 10.5, expectedUnit: "m/s" },
    { input: "-20 degC", expectedVal: -20, expectedUnit: "degC" },
    { input: "foo", expectedType: DataType.String }
];

parseCases.forEach(c => {
    const p = PayloadUtils.parseString(c.input);
    if ('expectedType' in c) {
        console.log(`  "${c.input}" -> Type ${p.type} [${p.type === c.expectedType ? 'PASS' : 'FAIL'}]`);
    } else {
        const valPass = p.value === c.expectedVal;
        const unitPass = p.meta.unit === c.expectedUnit;
        console.log(`  "${c.input}" -> ${p.value} ${p.meta.unit || ''} [${valPass && unitPass ? 'PASS' : 'FAIL'}]`);
    }
});

// 5. Test Error Handling (Robustness)
console.log('\n[Test 5] Error Handling');
const errorCases = [
    { input: "4k'g", desc: "Malformed Unit String" },
    { input: "invalid", desc: "Non-numeric String" }
];

// Mock Engine for Error Testing
try {
    const errorNode = { ...mathNodeStub, data: { op: 'ADD' } };
    // Simulate inputs that result in raw strings
    const inputs = {
        in_a: { type: DataType.String, value: "4k'g", symbol: null, meta: {} },
        in_b: PayloadUtils.createScalar(10)
    };

    const result = NodeRegistry.evaluate(errorNode, inputs);

    if (result.type === DataType.Error) {
        console.log(`  ${inputs.in_a.value} -> Error Payload [PASS]`);
        console.log(`  Message: ${result.meta.error}`);
    } else {
        console.log(`  ${inputs.in_a.value} -> Type ${result.type} [FAIL]`);
    }

} catch (e) {
    console.log(`  Crash Detected: ${(e as Error).message} [FAIL]`);
}

// 6. Test Unit Node Logic
console.log('\n[Test 6] Unit Node Logic');
const unitNode = {
    id: 'unit-node',
    type: 'IO-05',
    value: PayloadUtils.createScalar(0),
    isDirty: true,
    data: { unit: 'm/s' }
};

const unitInputs = {
    in: PayloadUtils.createScalar(50)
};

const unitResult = NodeRegistry.evaluate(unitNode, unitInputs);
console.log(`  Input: ${PayloadUtils.unwrap(unitInputs.in)} -> Unit: ${unitNode.data.unit}`);
if (unitResult.meta.unit === 'm/s' && PayloadUtils.unwrap(unitResult) === 50) {
    console.log(`  Output: ${PayloadUtils.unwrap(unitResult)} ${unitResult.meta.unit} [PASS]`);
}

// 7. Test Unit Node Update (Simulate Interaction)
console.log('\n[Test 7] Unit Node Update');
// Initial state: 50 m/s
// Simulate changing unit to 'km/h' via UPDATE_NODE_DATA
const updatedUnitNode = {
    ...unitNode,
    data: { unit: 'km/h' } // Simulate applying transaction
};
const updatedResult = NodeRegistry.evaluate(updatedUnitNode, unitInputs);

if (updatedResult.meta.unit === 'km/h' && PayloadUtils.unwrap(updatedResult) === 50) {
    console.log(`  Update Unit to km/h -> Output: ${PayloadUtils.unwrap(updatedResult)} ${updatedResult.meta.unit} [PASS]`);
} else {
    console.log(`  Update Failed: ${JSON.stringify(updatedResult)} [FAIL]`);
}

// 8. Test Physics Math (Unit Conversion)
console.log('\n[Test 8] Physics Math (Unit Conversion)');
// Case: 110 cm + 1 m = 2.1 m (or 210 cm)
// We need to simulate the nodes.
const nodePhysics = {
    id: 'phys-add',
    type: 'MA-01',
    value: PayloadUtils.createScalar(0),
    isDirty: true,
    data: { op: 'ADD' }
};

const inputsPhysics = {
    in_a: PayloadUtils.createScalar(110, 'cm'),
    in_b: PayloadUtils.createScalar(1, 'm')
};

const resultPhysics = NodeRegistry.evaluate(nodePhysics, inputsPhysics);
const valP = PayloadUtils.unwrap(resultPhysics);
const unitP = resultPhysics.meta.unit;

console.log(`  110 cm + 1 m = ${valP} ${unitP}`);

// Accept either 2.1 m or 210 cm
if ((valP === 2.1 && unitP === 'm') || (valP === 210 && unitP === 'cm')) {
    console.log(`  [PASS] Unit conversion successful`);
} else {
    console.log(`  [FAIL] Expected 2.1 m or 210 cm`);
}

// 9. Test Unit Conversion Node (IO-05 Upgrade)
console.log('\n[Test 9] Unit Conversion Node');

// Case A: Assignment (Scalar -> Unit)
const nodeAssign = { id: 'assign', type: 'IO-05', data: { unit: 'm' }, value: PayloadUtils.createScalar(0), isDirty: true };
const inputScalar = { in: PayloadUtils.createScalar(10) };
const resAssign = NodeRegistry.evaluate(nodeAssign, inputScalar);
console.log(`  Assign: 10 -> m = ${PayloadUtils.unwrap(resAssign)} ${resAssign.meta.unit}`);
if (PayloadUtils.unwrap(resAssign) === 10 && resAssign.meta.unit === 'm') console.log('  [PASS]');
else console.log('  [FAIL]');

// Case B: Conversion (Unit -> Unit)
const nodeConvert = { id: 'convert', type: 'IO-05', data: { unit: 'm' }, value: PayloadUtils.createScalar(0), isDirty: true };
const inputUnit = { in: PayloadUtils.createScalar(100, 'cm') };
const resConvert = NodeRegistry.evaluate(nodeConvert, inputUnit);
console.log(`  Convert: 100 cm -> m = ${PayloadUtils.unwrap(resConvert)} ${resConvert.meta.unit}`);
if (PayloadUtils.unwrap(resConvert) === 1 && resConvert.meta.unit === 'm') console.log('  [PASS]');
else console.log('  [FAIL]');

// Case C: Incompatible (kg -> m)
const nodeError = { id: 'err', type: 'IO-05', data: { unit: 'm' }, value: PayloadUtils.createScalar(0), isDirty: true };
const inputBad = { in: PayloadUtils.createScalar(10, 'kg') };
const resError = NodeRegistry.evaluate(nodeError, inputBad);
console.log(`  Error: 10 kg -> m = ${resError.type}`);
if (resError.type === 'error') console.log('  [PASS]');
else console.log('  [FAIL]');

// 10. Test Unit Conversion Bug (MathNode -> UnitNode)
console.log('\n[Test 10] MathNode -> UnitNode Chain');
// Scenario: 1110 cm + 128 km -> Unit(ft)
// 1. MathNode
const inputBigA = PayloadUtils.createScalar(1110, 'cm');
const inputBigB = PayloadUtils.createScalar(128, 'km');
const mathNodeBig = { id: 'math-big', type: 'MA-01', value: PayloadUtils.createScalar(0), isDirty: true, data: { op: 'ADD' } };
// @ts-ignore
const mathResultBig = NodeRegistry.evaluate(mathNodeBig, { in_a: inputBigA, in_b: inputBigB });

console.log(`  Math Output: ${PayloadUtils.unwrap(mathResultBig)} ${mathResultBig.meta.unit}`);

// 2. UnitNode (Convert to ft)
const unitNodeFt = { id: 'unit-ft', type: 'IO-05', value: PayloadUtils.createScalar(0), isDirty: true, data: { unit: 'ft' } };
// @ts-ignore
const finalResultChain = NodeRegistry.evaluate(unitNodeFt, { in: mathResultBig });

console.log(`  Final Output: ${PayloadUtils.unwrap(finalResultChain)} ${finalResultChain.meta.unit}`);

const valChain = PayloadUtils.unwrap(finalResultChain);
if (valChain > 419000 && valChain < 421000 && finalResultChain.meta.unit === 'ft') {
    console.log(`  [PASS] Conversion successful: ${valChain} ft`);
} else if (valChain === 12801110 && finalResultChain.meta.unit === 'ft') {
    console.log(`  [FAIL] No conversion (Unit Assignment only)`);
} else {
    console.log(`  [FAIL] Unexpected result ${valChain} ${finalResultChain.meta.unit}`);
}
