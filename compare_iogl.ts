const original = `
[Monthly Payment] IN-01 300 @83,875
[Pay per year] MA-01 { mode: "MUL" } @726,1128
[12 months] IN-01 12 @406,998
[Annual Pay] OT-01 { mode: "text" } @1421,634
[Current Age] IN-01 28 @83,1013
[Predict the age you'll die] IN-01 70 @83,1288
[Pay per year] MA-01 { mode: "MUL" } @1052,938
[Age of first insurance purchase] IN-01 18 @83,1148
[Basic Math] MA-01 { mode: "SUB" } @726,999
[Total Spent (until now)] OT-01 { mode: "text" } @1421,889
[Basic Math] MA-01 { mode: "SUB" } @726,1251
[Pay per year] MA-01 { mode: "MUL" } @1052,1078
[Remaining Pay (until death)] OT-01 { mode: "auto" } @1421,1400
[Basic Math] MA-01 { mode: "SUB" } @402,1411
[Lifespan] OT-01 { mode: "auto" } @1421,1142
[c1] IN-01 1 @726,1632
[tm] MA-01 { mode: "MUL" } @726,1773
[rm] MA-01 { mode: "DIV" } @726,1374
[base] MA-01 { mode: "ADD" } @726,1499
[pow] MA-02 { mode: "POW" } @1052,1216
[num] MA-01 { mode: "SUB" } @1052,1338
[divi] MA-01 { mode: "DIV" } @1052,1461
[m1] MA-01 { mode: "MUL" } @1052,1592
[m2] MA-01 { mode: "MUL" } @1052,1710
[Investment Gains (start buying until death)] OT-01 2 { mode: "text" } @1421,1674
[Basic Math] MA-01 { mode: "DIV" } @402,1137
[Number] IN-01 100 @402,1272
[Expected Annual ROI %] IN-02 5, -10, 10, 0.1 @84,1442
[Basic Math] MA-01 { mode: "MUL" } @1052,805
[Agent earns % commission annually] IN-02 23, 0, 100, 1 @83,1603
[Avg. Agent Fee] OT-01 { mode: "auto" } @1421,1954
[Basic Math] MA-01 { mode: "DIV" } @726,735
[Number] IN-01 100 @726,865
[Sticky Note] UT-01 "# Math doesn't lie; agents do." @560,425

Monthly Payment.a -> Pay per year.a
12 months.a -> Pay per year.b
Pay per year.a -> Annual Pay.a
Pay per year.a -> Pay per year.a
Current Age.a -> Basic Math.a
Age of first insurance purchase.a -> Basic Math.b
Basic Math.a -> Pay per year.b
Pay per year.a -> Total Spent (until now).a
Predict the age you'll die.a -> Basic Math.a
Current Age.a -> Basic Math.b
Pay per year.a -> Pay per year.a
Basic Math.a -> Pay per year.b
Pay per year.a -> Remaining Pay (until death).a
Predict the age you'll die.a -> Basic Math.a
Age of first insurance purchase.a -> Basic Math.b
Basic Math.a -> Lifespan.a
rm.a -> base.a
c1.a -> base.b
base.a -> pow.a
tm.a -> pow.b
pow.a -> num.a
c1.a -> num.b
num.a -> divi.a
rm.a -> divi.b
divi.a -> m1.a
m1.a -> m2.a
base.a -> m2.b
m2.a -> Investment Gains (start buying until death).a
Monthly Payment.a -> m1.b
Number.a -> Basic Math.b
Basic Math.a -> rm.a
Basic Math.a -> tm.a
Expected Annual ROI %.a -> Basic Math.a
Pay per year.a -> Basic Math.a
Basic Math.a -> Avg. Agent Fee.a
Agent earns % commission annually.a -> Basic Math.a
Number.a -> Basic Math.b
Basic Math.a -> Basic Math.b
12 months.a -> rm.b
12 months.a -> tm.b
`;

import { Parser } from './src/iogl/Parser';
import * as fs from 'fs';

const parserOrig = new Parser(original);
const resOrig = parserOrig.parse();
console.log('Original Diagnostics:', JSON.stringify(resOrig.diagnostics, null, 2));

const updatedContent = fs.readFileSync('src/templates/InsuranceExpert.iogl', 'utf-8');
const parserUpd = new Parser(updatedContent);
const resUpd = parserUpd.parse();
console.log('Updated Diagnostics:', JSON.stringify(resUpd.diagnostics, null, 2));

console.log('Original Edges:', resOrig.graph.edges.length);
console.log('Updated Edges:', resUpd.graph.edges.length);
