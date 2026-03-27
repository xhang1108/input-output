/**
 * 🌉 BrainWorkerProxy
 * 
 * Main-thread adapter that manages communication with the brain.worker.ts.
 * Handles epoch-based stale result prevention, request coalescing,
 * crash recovery with auto-respawn, and audit logging.
 * 
 * Phase 4.1: Web Worker Migration
 */

import { MATH_CONFIG, getMathConfig, MathPrecision } from './mathConfig';
import { PayloadUtils } from '../utils/PayloadUtils';
import { NodePayload } from '../types/payload';
import type { NodeLogic } from './types';
import type {
    WorkerRequest,
    WorkerResponse,
    SerializedGraphSnapshot,
    SerializedPayload,
    IncrementalPatch,
} from './SerializableGraph';
import type { Edge } from '@xyflow/react';
import { debugManager } from '../debug/DebugManager';

// ─── Audit Log ─────────────────────────────────────────────────────

interface AuditEntry {
    direction: 'OUT' | 'IN';
    type: string;
    msgId: number;
    epoch: number;
    timestamp: number;
}

const AUDIT_LOG_SIZE = 20;

// ─── Callback Types ────────────────────────────────────────────────

export interface WorkerProxyCallbacks {
    /** Called when Worker returns valid results (epoch matches) */
    onResults: (patches: Map<string, NodePayload>, latencyMs: number) => void;
    /** Called when Worker encounters an error */
    onError: (epoch: number, error: string) => void;
    /** Called when Worker is syncing (loading state) */
    onSyncing: () => void;
    /** Called when Worker is ready */
    onReady: () => void;
}

// ─── Proxy Class ───────────────────────────────────────────────────

export class BrainWorkerProxy {
    private worker: Worker | null = null;
    private epoch = 0;
    private msgId = 0;
    private pendingRequest = false;
    private requestStartTime: number | null = null;
    private queuedPatch: IncrementalPatch | null = null;
    private auditLog: AuditEntry[] = [];
    private callbacks: WorkerProxyCallbacks;
    private evalsSinceLastHealth = 0;
    private readonly HEALTH_CHECK_INTERVAL = 50;
    private retryCount = 0;
    private readonly MAX_RETRIES = 3;
    private isBlocked = false;

    // Reference to main-thread brain state for HEALTH validation
    private getMainThreadCounts: (() => { nodeCount: number; edgeCount: number }) | null = null;
    private requestFullSync: (() => void) | null = null;

    constructor(callbacks: WorkerProxyCallbacks) {
        this.callbacks = callbacks;
        this.spawnWorker();
    }

    // ─── Worker Lifecycle ──────────────────────────────────────────

    private spawnWorker() {
        if (this.isBlocked) return;
        
        try {
            this.worker = new Worker(
                new URL('./brain.worker.ts', import.meta.url),
                { type: 'module' }
            );

            this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                this.retryCount = 0; // Reset on successful message
                this.handleMessage(event.data);
            };

            this.worker.onerror = (error) => {
                const message = (error as any).message || 'Unknown error';
                const filename = (error as any).filename || '';
                const lineno = (error as any).lineno || 0;
                
                console.error(`[BrainWorkerProxy] Worker crashed: ${message} at ${filename}:${lineno}`);
                debugManager.trackWorkerError({ message, filename, lineno });

                // Detect Ad-blocker / Network failures
                const isNetworkError = message.includes('NetworkError') || 
                                     message.toLowerCase().includes('failed to fetch') ||
                                     message.toLowerCase().includes('importscripts');

                if (isNetworkError) {
                    this.retryCount++;
                    console.warn(`[BrainWorkerProxy] Network/Loading error detected (Retry ${this.retryCount}/${this.MAX_RETRIES})`);
                    
                    if (this.retryCount >= this.MAX_RETRIES) {
                        this.isBlocked = true;
                        console.error('[BrainWorkerProxy] Persistent loading failure. Marking as BLOCKED.');
                        this.callbacks.onError(this.epoch, 'ENGINE_BLOCKED');
                        return;
                    }
                }

                this.handleCrash();
            };

            this.worker.onmessageerror = (error) => {
                console.error('[BrainWorkerProxy] Message error:', error);
                this.handleCrash();
            };

            // Send INIT with shared config
            this.send({ type: 'INIT', msgId: this.nextMsgId(), config: MATH_CONFIG });
        } catch (error) {
            console.error('[BrainWorkerProxy] Failed to spawn Worker:', error);
        }
    }

    private handleCrash() {
        console.warn('[BrainWorkerProxy] Respawning Worker...');
        debugManager.trackWorkerError('Worker crashed (Respawning)');
        this.pendingRequest = false;
        this.queuedPatch = null;
        
        // Notify main thread that a crash occurred so locks (like isRecalculating) can be released
        this.callbacks.onError(this.epoch, 'Worker crashed unexpectedly');

        // Terminate old worker
        if (this.worker) {
            try { this.worker.terminate(); } catch { /* ignore */ }
            this.worker = null;
        }

        // Respawn
        this.spawnWorker();

        // Request full sync from Brain
        if (this.requestFullSync) {
            this.requestFullSync();
        }
    }

    // ─── Message Sending ───────────────────────────────────────────

    private nextMsgId(): number {
        return ++this.msgId;
    }

    private send(msg: WorkerRequest) {
        if (!this.worker) return;
        const epoch = 'epoch' in msg ? msg.epoch : 0;
        this.pushAudit('OUT', msg.type, msg.msgId, epoch);
        this.worker.postMessage(msg);
    }

    // ─── Message Handling ──────────────────────────────────────────

    private handleMessage(msg: WorkerResponse) {
        this.pushAudit('IN', msg.type, this.msgId, 'epoch' in msg ? msg.epoch : 0);

        switch (msg.type) {
            case 'READY':
                this.callbacks.onReady();
                break;

            case 'RESULT': {
                this.pendingRequest = false;

                // Stale guard: discard if epoch doesn't match
                if (msg.epoch < this.epoch) {
                    // Process queued patch if any
                    this.flushQueue();
                    return;
                }

                // Hydrate results: convert dehydrated payloads back to NodePayload
                const patches = new Map<string, NodePayload>();
                for (const [id, sp] of Object.entries(msg.patches)) {
                    patches.set(id, {
                        type: sp.type,
                        value: sp.value,
                        symbol: sp.symbol,
                        meta: sp.meta,
                    });
                }

                const latencyMs = this.requestStartTime ? Date.now() - this.requestStartTime : 0;
                this.requestStartTime = null;

                this.callbacks.onResults(patches, latencyMs);

                // Periodic HEALTH check
                this.evalsSinceLastHealth++;
                if (this.evalsSinceLastHealth >= this.HEALTH_CHECK_INTERVAL) {
                    this.requestHealthCheck();
                    this.evalsSinceLastHealth = 0;
                }

                // Process queued patch if any
                this.flushQueue();
                break;
            }

            case 'ERROR': {
                this.pendingRequest = false;
                if (msg.epoch >= this.epoch) {
                    this.callbacks.onError(msg.epoch, msg.error);
                }
                this.flushQueue();
                break;
            }

            case 'HEALTH': {
                this.validateHealth(msg);
                break;
            }
        }
    }

    // ─── Public API ────────────────────────────────────────────────

    /** Increment epoch and request evaluation with incremental patch */
    public requestEval(patch: IncrementalPatch) {
        this.epoch++;

        if (this.pendingRequest) {
            // Coalesce: keep only the latest patch
            this.queuedPatch = patch;
            return;
        }

        this.pendingRequest = true;
        this.requestStartTime = Date.now();
        this.send({
            type: 'EVAL',
            msgId: this.nextMsgId(),
            epoch: this.epoch,
            patches: patch,
        });
    }

    /** Atomic full-sync + eval: replace graph then compute dirty nodes */
    public syncAndEval(snapshot: SerializedGraphSnapshot, dirtyChainNodeIds: string[]) {
        this.epoch++;
        this.pendingRequest = true;
        this.requestStartTime = Date.now();
        this.queuedPatch = null; // Clear any queued incremental patches
        this.send({
            type: 'SYNC_AND_EVAL',
            msgId: this.nextMsgId(),
            epoch: this.epoch,
            snapshot,
            dirtyChainNodeIds,
        });
    }

    /** Send full graph snapshot (project load, crash recovery, batch undo) */
    public syncGraph(snapshot: SerializedGraphSnapshot) {
        this.callbacks.onSyncing();
        this.pendingRequest = false;
        this.queuedPatch = null;
        this.send({
            type: 'SYNC_GRAPH',
            msgId: this.nextMsgId(),
            snapshot,
        });
    }

    /** Update worker math configuration (precision) */
    public updateConfig(precision: MathPrecision) {
        this.send({
            type: 'UPDATE_CONFIG',
            msgId: this.nextMsgId(),
            config: getMathConfig(precision),
        });
    }

    /** Clear all Worker state (project switch) */
    public clearState() {
        this.pendingRequest = false;
        this.queuedPatch = null;
        this.send({ type: 'CLEAR_STATE', msgId: this.nextMsgId() });
    }

    /** Get current epoch */
    public getEpoch(): number {
        return this.epoch;
    }

    /** Register references for HEALTH validation */
    public registerHealthRefs(
        getCounts: () => { nodeCount: number; edgeCount: number },
        fullSync: () => void
    ) {
        this.getMainThreadCounts = getCounts;
        this.requestFullSync = fullSync;
    }

    /** Export audit log for debugging */
    public getAuditLog(): AuditEntry[] {
        return [...this.auditLog];
    }

    /** Terminate and cleanup the Worker */
    public dispose() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    // ─── Internal Helpers ──────────────────────────────────────────

    /**
     * Helper to strip functions and non-serializable values from objects 
     * before sending across postMessage.
     */
    private static sanitizeData(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(v => BrainWorkerProxy.sanitizeData(v));

        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip functions
            if (typeof value === 'function') continue;

            // Recursively sanitize objects and arrays
            if (value !== null && typeof value === 'object') {
                result[key] = BrainWorkerProxy.sanitizeData(value);
            } else {
                result[key] = value;
            }
        }
        return result;
    }

    private flushQueue() {
        if (this.queuedPatch && !this.pendingRequest) {
            const patch = this.queuedPatch;
            this.queuedPatch = null;
            this.requestEval(patch);
        }
    }

    private requestHealthCheck() {
        if (!this.getMainThreadCounts) return;

        // Pick 3 random node IDs for hash sampling
        const counts = this.getMainThreadCounts();
        // We don't have direct access to node IDs here — Brain will provide via getCounts
        this.send({
            type: 'HEALTH_CHECK',
            msgId: this.nextMsgId(),
        });
    }

    private validateHealth(msg: Extract<WorkerResponse, { type: 'HEALTH' }>) {
        if (!this.getMainThreadCounts) return;
        const mainCounts = this.getMainThreadCounts();

        if (msg.nodeCount !== mainCounts.nodeCount || msg.edgeCount !== mainCounts.edgeCount) {
            console.warn(
                `[BrainWorkerProxy] HEALTH mismatch! ` +
                `Main: ${mainCounts.nodeCount}N/${mainCounts.edgeCount}E, ` +
                `Worker: ${msg.nodeCount}N/${msg.edgeCount}E. Forcing SYNC_GRAPH.`
            );
            if (this.requestFullSync) {
                this.requestFullSync();
            }
        }
    }

    private pushAudit(direction: 'OUT' | 'IN', type: string, msgId: number, epoch: number) {
        this.auditLog.push({ direction, type, msgId, epoch, timestamp: Date.now() });
        if (this.auditLog.length > AUDIT_LOG_SIZE) {
            this.auditLog.shift();
        }
    }

    // ─── Serialization Helpers (Static) ────────────────────────────

    /** Serialize a Brain NodeLogic into a Worker-safe SerializedNodeLogic */
    static serializeNode(node: NodeLogic): import('./SerializableGraph').SerializedNodeLogic {
        return {
            id: node.id,
            type: node.type || 'baseNode',
            value: node.value ? {
                type: node.value.type,
                value: PayloadUtils.dehydrate(node.value.value),
                symbol: PayloadUtils.dehydrate(node.value.symbol) as import('../types/payload').ASTNode | null,
                meta: PayloadUtils.dehydrate(node.value.meta) as Record<string, unknown>,
            } : null,
            data: BrainWorkerProxy.sanitizeData(node.data) || {},
            isInDirtyChain: !!node.isInDirtyChain,
        };
    }

    /** Serialize a React Flow Edge into a Worker-safe SerializedEdge */
    static serializeEdge(edge: Edge): import('./SerializableGraph').SerializedEdge {
        return {
            id: edge.id,
            source: edge.source,
            sourceHandle: edge.sourceHandle || '',
            target: edge.target,
            targetHandle: edge.targetHandle || '',
        };
    }

    /** Build a full graph snapshot from Brain state */
    static buildSnapshot(
        nodesMap: Map<string, NodeLogic>,
        edges: Edge[]
    ): SerializedGraphSnapshot {
        return {
            nodes: Array.from(nodesMap.values()).map(n => BrainWorkerProxy.serializeNode(n)),
            edges: edges.map(e => BrainWorkerProxy.serializeEdge(e)),
        };
    }
}
