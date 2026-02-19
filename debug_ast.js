
const { parseTex } = require('tex-math-parser');

const latex = 'x^2';
try {
    const ast = parseTex(latex);
    console.log(JSON.stringify(ast, null, 2));
} catch (e) {
    console.error(e);
}
