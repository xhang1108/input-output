import { beforeEach, beforeAll } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { InputOutputEngine } from '@/engine/InputOutputEngine';
import { NerdamerService } from '@/engine/calculus/NerdamerService';
import { Brain } from '@/engine/Brain';

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

