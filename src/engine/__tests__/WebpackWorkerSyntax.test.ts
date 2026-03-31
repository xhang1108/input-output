import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Webpack Worker Syntax AST Enforcer 
 * 
 * In Next.js (Webpack 5), Web Workers MUST be instantiated using the strict AST pattern:
 *     new Worker(new URL('./path/to/worker.ts', import.meta.url), { type: 'module' });
 * 
 * If the `new URL(...)` is extracted to a variable (e.g. `const url = new URL(...)`), 
 * Webpack fails to parse it as a Web Worker chunk, treating it as a raw Static Media Asset instead.
 * This causes an opaque, uncatchable SyntaxError in the browser at load time (Worker crashed at :0).
 * 
 * This static analysis test ensures no developer accidentally breaks this pattern.
 */

describe('Webpack Web Worker Syntax Enforcer', () => {

    // Scans recursively through directories to find .ts files
    const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
        const files = fs.readdirSync(dirPath);

        files.forEach((file) => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (!['node_modules', '.next', 'dist', 'build'].includes(file)) {
                    arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
                }
            } else {
                if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                    arrayOfFiles.push(fullPath);
                }
            }
        });

        return arrayOfFiles;
    };

    test('All `new Worker` calls MUST strictly inline `new URL(..., import.meta.url)`', () => {
        // Point to src/
        const srcDir = path.resolve(__dirname, '../../');
        const allFiles = getAllFiles(srcDir);

        let workerInstancesFound = 0;

        allFiles.forEach(file => {
            const content = fs.readFileSync(file, 'utf-8');

            // Ignore this test file itself
            if (file.includes('WebpackWorkerSyntax.test.ts')) return;

            const lines = content.split('\n');
            lines.forEach((line, index) => {
                // Ignore comments and custom wrappers
                if (line.includes('new Worker(') && !line.trim().startsWith('//') && !line.includes('new WorkerOrchestrator')) {
                    workerInstancesFound++;

                    // To handle multi-line indentation, combine this line with the next 2 lines and strip whitespace
                    const chunk = lines.slice(index, index + 3).join('').replace(/\s+/g, '');

                    const isValidPattern = chunk.includes('newWorker(newURL(');

                    if (!isValidPattern) {
                        throw new Error(
                            `\nINVALID WEB WORKER SYNTAX DETECTED in ${file}:${index + 1}\n\n` +
                            `Found: ${line.trim()}\n\n` +
                            `Next.js Webpack 5 requires the 'new URL' to be strictly inlined within the 'new Worker' constructor.\n` +
                            `Extracting it to a variable will cause the Worker to be served as a raw media asset, crashing production.\n\n` +
                            `Fix it by changing to: new Worker(new URL('./path.ts', import.meta.url), { ... });\n`
                        );
                    }
                }
            });
        });

        // Ensure we actually scanned the codebase (should find at least 1 in BrainWorkerProxy.ts)
        expect(workerInstancesFound).toBeGreaterThanOrEqual(1);
    });
});
