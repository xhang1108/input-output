import vegaEmbed from 'vega-embed';
import { compile } from 'vega-lite';
console.log('Testing vega compilation');
const spec = {
  "\": "https://vega.github.io/schema/vega-lite/v6.json",
  "data": { "values": [
    { "x": 2, "y": -10, "series": "Series 1" },
    { "x": 2, "y": 0, "series": "Series 1" },
    { "x": 2, "y": 10, "series": "Series 1" }
  ]},
  "mark": { "type": "line", "interpolate": "monotone" },
  "encoding": {
    "x": { "field": "x", "type": "quantitative" },
    "y": { "field": "y", "type": "quantitative" },
    "color": { "field": "series", "type": "nominal" }
  }
};
try {
  compile(spec as any);
  console.log('Compile Success');
} catch(e) {
  console.log('Compile error:', e);
}
