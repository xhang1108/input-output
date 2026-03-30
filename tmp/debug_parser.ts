
import { GraphCodec } from './src/engine/GraphCodec';
import fs from 'fs';
import path from 'path';

async function debug() {
    const filePath = path.join(process.cwd(), 'public/examples/benchmarks/benchmark_calculus.iogl');
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const { diagnostics } = GraphCodec.parse(content);
    console.log('--- DIAGNOSTICS ---');
    console.log(JSON.stringify(diagnostics, null, 2));
}

debug();
