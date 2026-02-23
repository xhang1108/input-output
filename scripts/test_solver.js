const nerdamer = require('nerdamer/all');

function test(name, eq) {
    console.log(`\n--- ${name} ---`);
    console.log(`Input:`, eq);
    try {
        let res;
        if (Array.isArray(eq)) {
            res = nerdamer.solveEquations(eq);
        } else {
            res = nerdamer.solveEquations(eq);
        }

        let outStr = '';
        if (Array.isArray(res)) {
            const mappedValues = res.map(s => {
                try {
                    if (Array.isArray(s)) return `[${s.map(ss => {
                        try { return nerdamer(ss).text('decimals'); } catch { return ss.toString(); }
                    }).join(', ')}]`;
                    return nerdamer(s).text('decimals');
                } catch (e) { return s.toString(); }
            });
            outStr = `[${mappedValues.join(', ')}]`;
        } else {
            outStr = res.toString();
        }
        console.log(`Output:`, outStr);
    } catch (e) {
        console.error(`Error:`, e.message);
    }
}

// 1. 高次方程
test("三次方程式", "x^3 - 6*x^2 + 11*x - 6 = 0");
test("四次方程式", "x^4 - 5*x^2 + 4 = 0");
test("五次方程式", "x^5 - x + 1 = 0"); // 測試極限

// 2. 基本超越方程
test("簡單指數", "e^x = 5");
test("簡單對數", "log(x) = 2");

// 3. 複雜聯立方程
test("非線性方程組 (圓與直線)", ["x^2 + y^2 = 25", "x - y = 1"]);
test("三元一次方程組", ["x+y+z=6", "2*x-y+z=3", "3*x+2*y-z=4"]);
test("帶參數二元一次", ["a*x + b*y = c", "d*x + e*y = f"]);

// 4. 特殊情況
test("必定虛數解", "x^2 + 1 = 0");
test("分式方程解", "1/x + 1/(x-1) = 3");
test("絕對矛盾", "x = x + 1");
test("多個未知數，無方程組 (單解 x)", "x + y = 3"); // default solve for x

// 5. Test solve for specific variable
try {
    console.log('\n--- Solve For specific variable ---');
    console.log('nerdamer.solve("F = m * a", "m").toString():', nerdamer.solve("F = m * a", "m").toString());
    console.log('nerdamer.solveEquations(["F = m * a"], "m").toString():', nerdamer.solveEquations(["F = m * a"], "m").toString());
} catch (e) {
    console.error(e);
}
