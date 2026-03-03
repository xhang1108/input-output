const vega = require('vega');
const vegaLite = require('vega-lite');
const spec = {
  "\": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "values": [
    { "x": 2, "y": -10, "series": "Series 1" },
    { "x": 2, "y": 0, "series": "Series 1" },
    { "x": 2, "y": 10, "series": "Series 1" }
  ]},
  "mark": { "type": "line", "color": "#b084e9" },
  "encoding": {
    "x": { "field": "x", "type": "quantitative", "scale": { "domain": [-10, 10] } },
    "y": { "field": "y", "type": "quantitative" },
    "color": { "field": "series", "type": "nominal" }
  }
};
try {
  const vSpec = vegaLite.compile(spec).spec;
  console.log('Vega Lite Compiled Successfully');
} catch(e) {
  console.log('Error', e);
}
