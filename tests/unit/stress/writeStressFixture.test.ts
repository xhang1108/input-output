import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStressFixture } from './stressFixture';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = path.resolve(HERE, '../../fixtures/stress/stress-500.json');

/**
 * Opt-in artifact writer. Keeps the normal suite side-effect free:
 *   PS> $env:STRESS_WRITE='1'; npx vitest run tests/unit/stress
 *   PS> Remove-Item Env:STRESS_WRITE; npx vitest run tests/unit/stress
 */
const shouldWrite = process.env.STRESS_WRITE === '1';

describe('stressFixture artifact writer', () => {
    it.skipIf(!shouldWrite)('writes a pretty-printed, stable JSON artifact', () => {
        const fixture = buildStressFixture();
        const json = `${JSON.stringify(fixture, null, 2)}\n`;

        mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
        writeFileSync(ARTIFACT_PATH, json, 'utf8');

        expect(existsSync(ARTIFACT_PATH)).toBe(true);
        expect(readFileSync(ARTIFACT_PATH, 'utf8')).toBe(json);
        expect(JSON.parse(json)).toEqual(fixture);

        // Stable key order: the writer must not reorder anything on a re-run.
        expect(Object.keys(JSON.parse(json))).toEqual(['name', 'version', 'nodes', 'edges']);

        const bytes = statSync(ARTIFACT_PATH).size;
        expect(bytes).toBe(Buffer.byteLength(json, 'utf8'));
        expect(bytes).toBeGreaterThan(0);
    });

    it.skipIf(shouldWrite)('stays skipped unless STRESS_WRITE=1', () => {
        expect(process.env.STRESS_WRITE).not.toBe('1');
    });
});
