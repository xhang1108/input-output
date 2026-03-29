
import { Parser } from './src/iogl/Parser';

const input = `
[Monthly Payment] IN-01 300 @83,875
[Pay per year] IN-01 3600 @300,300
[Rates] IN-07 [[1,2],[3,4]] @500,500
[Monthly Payment].a -> [Pay per year].a
[Pay per year].a -> [Rates].a
`;

const parser = new Parser(input);
const { graph, diagnostics } = parser.parse();

console.log('Diagnostics:', diagnostics);
console.log('Nodes:', graph.nodes.map(n => n.data.label));
const ratesNode = graph.nodes.find(n => n.data.label === 'Rates');
console.log('Rates Data:', JSON.stringify(ratesNode?.data.array || ratesNode?.data.value));
console.log('Edges:', graph.edges.length);
