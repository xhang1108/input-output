import { renderToString } from 'react-dom/server';
import { usePlotData } from './src/components/nodes/hooks/usePlotData';
import { usePlotSpec } from './src/components/nodes/hooks/usePlotSpec';

function TestPlot() {
    const { payloads, plotData } = usePlotData({
        value: { type: 'scalar', value: 'x=2' }, // Mocking string payload
        minX: -10,
        maxX: 10,
        points: 100
    });

    const spec = usePlotSpec({
        viewMode: 'line',
        plotData,
        minX: -10,
        maxX: 10
    });

    console.log("PlotData:", plotData);
    console.log("Spec:", JSON.stringify(spec, null, 2));
    return null;
}

TestPlot();
