#!/usr/bin/env node
/**
 * Verify that every place a release version can appear agrees on one value.
 *
 * Checks: package.json == package-lock.json (root + "" entry), and — when a
 * release tag is supplied via `npm run verify:version -- vX.Y.Z` or
 * GITHUB_REF_NAME/GITHUB_REF_TYPE=tag — the tag matches package.json.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));

const pkg = read('package.json');
const lock = read('package-lock.json');

const errors = [];
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    errors.push(`package.json version is not semver: ${pkg.version}`);
}
if (lock.version !== pkg.version) {
    errors.push(`package-lock.json version ${lock.version} != package.json ${pkg.version}`);
}
if (lock.packages?.['']?.version !== pkg.version) {
    errors.push(`package-lock.json packages[""] version ${lock.packages?.['']?.version} != package.json ${pkg.version}`);
}

const argTag = process.argv[2];
const refTag =
    process.env.GITHUB_REF_TYPE === 'tag' || (process.env.GITHUB_REF || '').startsWith('refs/tags/')
        ? process.env.GITHUB_REF_NAME || (process.env.GITHUB_REF || '').replace('refs/tags/', '')
        : undefined;
const tag = argTag || refTag;
if (tag) {
    const tagVersion = tag.replace(/^v/, '');
    if (tagVersion !== pkg.version) {
        errors.push(`release tag ${tag} != package.json ${pkg.version}`);
    }
}

if (errors.length > 0) {
    console.error('✗ version check failed');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
}

console.log(`✓ version ${pkg.version} consistent${tag ? ` (tag ${tag})` : ''}`);
