import { PlottingUtils } from './src/utils/PlottingUtils';

const pts = PlottingUtils.generateSymbolicPoints('x=2', -10, 10, 10);
console.log(pts.slice(0, 3));
