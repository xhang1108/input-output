import { NodePayload } from '../types/payload';
import { IncrementalPatch } from './SerializableGraph';
import { NodeLogic } from './types';
import { useAppStore } from '../store/useStore';

/**
 * 🏗️ WorkerOrchestrator
 * 
 * Manages Web Worker lifecycle, synchronization, and result application.
 * Decouples the low-level worker threading logic from the main Brain logic.
 */
export class WorkerOrchestrator {
    public workerProxy: any = null;
    private workerInitPromise: Promise<void> | null = null;
    private freshlyUpdatedNodeIds: Set<string> = new Set();
    public useWorker = true;

    constructor(
        private callbacks: {
            onResults: (patches: Map<string, NodePayload>, latencyMs: number) => void,
            onTriggerDirty: (nodeId: string) => void,
            syncRequester: () => void,
            emit: (event: string, payload: unknown) => void
        }
    ) {
        // Subscribe to precision changes
        useAppStore.subscribe(
            (state) => state.mathPrecision,
            (precision) => {
                if (this.workerProxy) {
                    this.workerProxy.updateConfig(precision);
                }
            }
        );
    }

    public async init() {
        if (typeof window === 'undefined') return;
        if (this.workerProxy) return;
        if (this.workerInitPromise) return this.workerInitPromise;

        this.workerInitPromise = (async () => {
            try {
                const { BrainWorkerProxy } = await import('./BrainWorkerProxy');
                this.workerProxy = new BrainWorkerProxy({
                    onResults: this.callbacks.onResults,
                    onError: (epoch: number, error: string) => {
                        console.error('[WorkerOrchestrator] error:', error);
                        this.callbacks.emit('workerError', error);
                    },
                    onSyncing: () => this.callbacks.emit('workerSyncing', null),
                    onReady: () => {
                        this.callbacks.emit('workerReady', null);
                    },
                });
                this.workerProxy.registerHealthRefs(
                    () => ({ nodeCount: 0, edgeCount: 0 }), // Base values for health check
                    () => this.callbacks.syncRequester()
                );
            } catch (error) {
                console.error('[WorkerOrchestrator] init failed, using fallback:', error);
                this.useWorker = false;
            }
        })();

        return this.workerInitPromise;
    }

    public getProxy() { return this.workerProxy; }
    public isEnabled() { return this.useWorker; }
    public setFreshlyUpdated(nodeId: string) { this.freshlyUpdatedNodeIds.add(nodeId); }
    public clearFreshlyUpdated() { this.freshlyUpdatedNodeIds.clear(); }
    public getFreshlyUpdated() { return this.freshlyUpdatedNodeIds; }

    public async syncAndEval(nodes: Map<string, any>, edges: any[], adjacency: any) {
        if (!this.workerProxy || !this.useWorker) {
            console.warn('[WorkerOrchestrator] syncAndEval skipped: proxy exists?', !!this.workerProxy, 'useWorker:', this.useWorker);
            return;
        }
        const { BrainWorkerProxy } = await import('./BrainWorkerProxy');
        const snapshot = BrainWorkerProxy.buildSnapshot(nodes, edges);

        const dirtyChainNodeIds: string[] = [];
        for (const node of nodes.values()) {
            if (node.isInDirtyChain) dirtyChainNodeIds.push(node.id);
        }
        for (const nodeId of this.freshlyUpdatedNodeIds) {
            const children = adjacency.getChildren(nodeId);
            for (const childId of children) {
                if (!dirtyChainNodeIds.includes(childId)) dirtyChainNodeIds.push(childId);
            }
        }

        this.clearFreshlyUpdated();
        this.workerProxy.syncAndEval(snapshot, dirtyChainNodeIds);
    }
}
