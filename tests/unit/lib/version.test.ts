import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../../../package.json';
import lock from '../../../package-lock.json';
import { APP_VERSION } from '@/lib/version';
import { SCHEMA_VERSION } from '@/engine/schema';
import { Serializer } from '@/engine/Serializer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Every UI surface that renders the app version must read APP_VERSION. */
const VERSION_SURFACES = [
    'src/components/ui/StatusBar.tsx',
    'src/components/ui/Footer.tsx',
    'src/app/wiki/WikiClientView.tsx',
];

/** Every surface that writes a save-file version must read SCHEMA_VERSION. */
const SCHEMA_SURFACES = [
    'src/engine/schema.ts',
    'src/engine/Serializer.ts',
    'src/services/SaveManager.ts',
    'src/hooks/useProjectSave.ts',
    'src/hooks/useTemplateInitialization.ts',
    'src/components/ui/ProjectLoadScreen.tsx',
];

describe('application version', () => {
    it('comes from a single source of truth (package.json)', () => {
        expect(APP_VERSION).toBe(pkg.version);
    });

    it('is valid semver', () => {
        expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('keeps package-lock.json in sync', () => {
        expect(lock.version).toBe(pkg.version);
        expect(lock.packages[''].version).toBe(pkg.version);
    });

    it.each(VERSION_SURFACES)('%s has no hardcoded version literal', (relativePath) => {
        const source = readFileSync(path.join(ROOT, relativePath), 'utf8');
        expect(source).not.toMatch(/\bV\d+\.\d+/);
    });
});

describe('save-file schema version', () => {
    it('is the single constant used by the serializer', () => {
        expect(Serializer.VERSION).toBe(SCHEMA_VERSION);
    });

    it('is valid semver and independent of the app version', () => {
        expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it.each(SCHEMA_SURFACES)('%s does not inline a schema version literal', (relativePath) => {
        const source = readFileSync(path.join(ROOT, relativePath), 'utf8');
        expect(source).not.toMatch(/version:\s*['"]\d/);
    });
});
