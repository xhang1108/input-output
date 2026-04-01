import { beforeEach, beforeAll } from 'vitest';
import { NodeRegistry } from '../NodeRegistry';
import { InputOutputEngine } from '../InputOutputEngine';
import { NerdamerService } from '../calculus/NerdamerService';
import { Brain } from '../Brain';

beforeAll(() => {
    console.log('[Vitest Setup] Initializing NodeRegistry...');
    NodeRegistry.initializeNodes();
    
    // Clear singleton states to prevent pollution between test files
    InputOutputEngine.reset();
    NerdamerService.reset();
    Brain.disposeAll();
});

afterEach(() => {
    // Force cleanup after every single test for perfect isolation
    Brain.disposeAll();
});
