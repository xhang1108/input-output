
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

console.log('Testing 8m - 0');

try {
    const a = math.unit(8, 'm');
    const b = 0;

    console.log('a:', a.toString());
    console.log('b:', b);

    const result = math.subtract(a, b);
    console.log('Result:', result.toString());
} catch (e) {
    console.log('Error:', e.message);
}

try {
    const a = math.unit(8, 'm');
    const b = math.bignumber(0);

    console.log('a:', a.toString());
    console.log('b (BigNumber):', b.toString());

    const result = math.subtract(a, b);
    console.log('Result:', result.toString());
} catch (e) {
    console.log('Error (BigNumber):', e.message);
}
