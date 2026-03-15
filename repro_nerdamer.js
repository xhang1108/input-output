const nerdamer = require('nerdamer');
require('nerdamer/Algebra');
require('nerdamer/Solve');
require('nerdamer/Extra');

/**
 * Verify a solution by substituting back into the original equation.
 * Returns the residual |f(x)|. If < tolerance, solution is valid.
 */
function verifySolution(eqStr, varName, solution) {
    try {
        const standardized = eqStr.includes('=')
            ? `(${eqStr.split('=')[0]}) - (${eqStr.split('=')[1]})`
            : eqStr;
        const residual = Math.abs(Number(nerdamer(standardized).sub(varName, solution).evaluate().text('decimals')));
        return residual;
    } catch (e) {
        return Infinity;
    }
}

function solveFiltered(eqStr, varName, tolerance = 1e-4) {
    const standardized = eqStr.includes('=')
        ? `(${eqStr.split('=')[0]}) - (${eqStr.split('=')[1]})`
        : eqStr;

    const raw = nerdamer(`solve(${standardized}, ${varName})`).toString();
    const items = raw.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    
    const verified = items.filter(sol => {
        const residual = verifySolution(eqStr, varName, sol);
        return residual < tolerance;
    });

    return { raw: items.length, verified };
}

// Test 1: e^x = 5 (answer: ln(5) ≈ 1.6094)
console.log('\n=== e^x = 5 ===');
const t1 = solveFiltered('e^x=5', 'x');
console.log(`Raw: ${t1.raw} solutions, Verified:`, t1.verified);
t1.verified.forEach(sol => console.log(`  ${sol} ≈ ${Number(nerdamer(sol).evaluate().text('decimals')).toFixed(6)}`));

// Test 2: sin(x) = 0.5 (principal: ≈0.5236, ≈2.618)
console.log('\n=== sin(x) = 0.5, tolerance=1e-4 ===');
const t2 = solveFiltered('sin(x)=0.5', 'x');
console.log(`Raw: ${t2.raw} solutions, Verified:`, t2.verified);
t2.verified.forEach(sol => console.log(`  ${sol} ≈ ${Number(nerdamer(sol).evaluate().text('decimals')).toFixed(6)}`));

// Test 3: x^2 + x - 6 = 0 (exact: x=2, x=-3)
console.log('\n=== x^2+x-6=0 (should be exact) ===');
const t3 = solveFiltered('x^2+x-6=0', 'x', 1e-9);
console.log(`Raw: ${t3.raw} solutions, Verified:`, t3.verified);
