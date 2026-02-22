import { create, all } from 'mathjs';

const math = create(all);

const m1 = math.matrix([[2, 1], [1, 2]]);
console.log('--- EIGEN ---');
try {
    const eigen = math.eigs(m1);
    console.log('Keys:', Object.keys(eigen));
    console.log('Values:', eigen.values);
} catch (e) {
    console.log('Eigen Error:', (e as Error).message);
}

const m2 = math.matrix([[1, 2], [3, 4]]);
console.log('\n--- QR ---');
try {
    const qr = math.qr(m2);
    console.log('Keys:', Object.keys(qr));
} catch (e) {
    console.log('QR Error:', (e as Error).message);
}

console.log('\n--- LUP ---');
try {
    const lup = math.lup(m2);
    console.log('Keys:', Object.keys(lup));
    console.log('P:', lup.p);
} catch (e) {
    console.log('LUP Error:', (e as Error).message);
}

console.log('\n--- BIG NUMBER EIGEN ---');
const mathBig = create(all, { number: 'BigNumber', precision: 64 });
const mBig = mathBig.matrix([[mathBig.bignumber(2), mathBig.bignumber(1)], [mathBig.bignumber(1), mathBig.bignumber(2)]]);
try {
    const eigen = mathBig.eigs(mBig);
    console.log('BigNumber Eigen Success');
} catch (e) {
    console.log('BigNumber Eigen Error:', (e as Error).message);
}
