import {
    create,
    addDependencies,
    bignumberDependencies,
    unitDependencies,
    MathJsStatic
} from 'mathjs';

const math = create({
    addDependencies,
    bignumberDependencies,
    unitDependencies
}, {
    number: 'BigNumber',
    precision: 64
}) as MathJsStatic;

console.log('Testing MathEngine Unit Support...');

try {
    const a = math.unit(110, 'cm');
    const b = math.unit(1, 'm');
    console.log(`a: ${a.toString()}, b: ${b.toString()}`);

    const result = math.add(a, b);
    console.log(`Result: ${result.toString()}`);
} catch (e) {
    console.error('Error adding units:', e);
}

try {
    const a = math.bignumber(5);
    const b = math.unit(1, 'm');
    console.log(`a: ${a.toString()}, b: ${b.toString()}`);

    // This is expected to fail in strict mathjs? (scalar + unit)
    const result = math.add(a, b);
    console.log(`Result mixed: ${result.toString()}`);
} catch (e) {
    console.error('Error adding mixed:', e);
}
