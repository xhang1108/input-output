import { PlottingUtils } from '../src/utils/PlottingUtils';

const payloadStr = "x^2";
const payloadNum = 42;

console.log("String payload:");
console.log(PlottingUtils.generateSymbolicPoints(payloadStr, -10, 10, 5));

console.log("Number payload:");
console.log(PlottingUtils.mapDataPayload(payloadNum));
