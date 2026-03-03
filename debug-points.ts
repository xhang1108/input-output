import { PlottingUtils } from './src/utils/PlottingUtils';

const pts = PlottingUtils.generateSymbolicPoints('x=2', -10, 10, 10);
const validY = pts.filter(pt => pt.y !== null);
const validPts = pts.filter(pt =>
                pt.x !== null && pt.y !== null &&
                Number.isFinite(pt.x) && Number.isFinite(pt.y)
            );
console.log('Total PTS:', pts.length);
console.log('Valid Y:', validY.length);
console.log('Valid Pts:', validPts.length);
