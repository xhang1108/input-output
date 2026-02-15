
const {
    create,
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    bignumberDependencies,
    numberDependencies,
    unitDependencies,
    randomDependencies,
    randomIntDependencies,
    matrixDependencies,
    onesDependencies
} = require('mathjs');

const math = create({
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    bignumberDependencies,
    numberDependencies,
    unitDependencies,
    randomDependencies,
    randomIntDependencies,
    matrixDependencies,
    onesDependencies
}, {
    number: 'BigNumber',
    precision: 64
});

console.log('Testing Fix Logic for 8m - 0');

function safeEvaluate(op, inputA, inputB) {
    let procA = inputA;
    let procB = inputB;

    if (op === 'ADD' || op === 'SUB') {
        const isUnitA = procA && (procA.isUnit || procA.constructor.name === 'Unit');
        const isUnitB = procB && (procB.isUnit || procB.constructor.name === 'Unit');

        if (isUnitA && !isUnitB) {
            try {
                if (math.equal(procB, 0)) {
                    console.log('Promoting B to A unit:', procA.formatUnits());
                    procB = math.unit(0, procA.formatUnits());
                }
            } catch (e) { }
        } else if (!isUnitA && isUnitB) {
            try {
                if (math.equal(procA, 0)) {
                    console.log('Promoting A to B unit:', procB.formatUnits());
                    procA = math.unit(0, procB.formatUnits());
                }
            } catch (e) { }
        }
    }

    if (op === 'SUB') return math.subtract(procA, procB);
    if (op === 'ADD') return math.add(procA, procB);
}

try {
    const a = math.unit(8, 'm');
    const b = 0;

    console.log('a:', a.toString());
    console.log('b:', b);

    const result = safeEvaluate('SUB', a, b);
    console.log('Result:', result.toString());
} catch (e) {
    console.log('Error:', e.message);
}

try {
    const a = 0;
    const b = math.unit(5, 'kg');

    console.log('a:', a);
    console.log('b:', b.toString());

    const result = safeEvaluate('ADD', a, b);
    console.log('Result (0 + 5kg):', result.toString());
} catch (e) {
    console.log('Error (Reverse):', e.message);
}
