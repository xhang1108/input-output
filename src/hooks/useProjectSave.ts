import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import { useDebounceCallback } from 'usehooks-ts';
import { useBrain } from '../context/BrainContext';
import { Brain } from '../engine/Brain';
import { Serializer } from '../engine/Serializer';
import { SaveManager } from '../services/SaveManager';
import { useAppStore } from '../store/useStore';

import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';

function restoreSettings(settings: Record<string, unknown>) {
    const store = useAppStore.getState();
    if (typeof settings.manualSnap === 'boolean') store.setManualSnap(settings.manualSnap);
    if (typeof settings.showGrid === 'boolean') store.setShowGrid(settings.showGrid);
    if (typeof settings.showDebugStats === 'boolean') store.setShowDebugStats(settings.showDebugStats);
    else if (typeof settings.showDebug === 'boolean') store.setShowDebugStats(settings.showDebug);
    if (typeof settings.layoutAlgorithm === 'string') store.setLayoutAlgorithm(settings.layoutAlgorithm as any);
}

export function useProjectSave(projectId: string, existingVisibility?: 'private' | 'public') {
    const { getViewport, setViewport, fitView } = useReactFlow();
    const router = useRouter();
    const brain = useBrain();
    const isNavigatingRef = useRef(false);

    // Status & Dirty Tracking
    const saveStatus = useAppStore(s => s.saveStatus);
    const setSaveStatus = useAppStore(s => s.setSaveStatus);

    const [isCloudDirty, _setIsCloudDirty] = useState(false);
    const isCloudDirtyRef = useRef(false);
    const setIsCloudDirty = useCallback((dirty: boolean) => {
        isCloudDirtyRef.current = dirty;
        _setIsCloudDirty(dirty);
    }, []);

    const [isLoaded, setIsLoaded] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    const [projectMeta, setProjectMeta] = useState<{ title: string; visibility: 'private' | 'public'; userId: string } | null>(null);
    const { data: session } = useSession();
    const sessionUserId = useMemo(() => session?.user?.id, [session?.user?.id]);

    const lastSyncedPayloadRef = useRef<string | null>(null);
    const lastLocalSavePayloadRef = useRef<string | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const cloudTimerRef = useRef<NodeJS.Timeout | null>(null);
    const prevIdRef = useRef<string | null>(null);

    // URL parts can be encoded multiple times in some proxied environments
    let decodedProjectId = projectId || '';
    while (decodedProjectId.includes('%')) {
        try {
            const next = decodeURIComponent(decodedProjectId);
            if (next === decodedProjectId) break;
            decodedProjectId = next;
        } catch { break; }
    }

    // Check if the project is a Cloud graph based on the prefix 'cloud:'
    const [isCloud, setIsCloud] = useState(decodedProjectId.startsWith('cloud:'));

    const isPromotionSyncRef = useRef(false);

    // actualId should be the raw ID without any prefix for database lookups
    const actualId = decodedProjectId ? decodedProjectId.replace(/^(cloud:)+/i, '') : 'new';

    // NEW: Collision prevention for multiple "New Project" tabs
    const [tempNewId] = useState(() => {
        if (actualId === 'new') {
            return `local_backup_new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }
        return null;
    });

    const currentSlotIdRef = useRef<string | null>(
        (actualId === 'new') ? tempNewId : (isCloud ? `cloud:${actualId}` : actualId)
    );

    const tempNewIdRef = useRef<string | null>(tempNewId);

    // Track if this cloud project has been synced to the DB yet (session-scoped)
    const hasSyncedRef = useRef<boolean>(false);

    // We'll update hasSyncedRef during the initial load or first save

    // Helper: wait N frames then reveal
    const revealAfterPaint = useCallback(() => {
        // Wait 2 frames for React Flow to render nodes at final positions
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsLoaded(true);
            });
        });
    }, []);

    const fitViewToScene = useCallback((options: { duration?: number } = {}) => {
        const { duration = 0 } = options;
        requestAnimationFrame(() => {
            fitView({ duration, padding: 0.2, includeHiddenNodes: false });
            setTimeout(() => {
                fitView({ duration: Math.max(0, duration - 100), padding: 0.2 });
            }, 100);
        });
    }, [fitView]);

    const isOwner = !isCloud || (session?.user?.id !== undefined && projectMeta?.userId === session.user.id);
    const isReadOnly = isCloud && (session?.user?.id === undefined || (projectMeta !== null && projectMeta.userId !== session.user.id));

    const saveProject = useCallback(async (silent = false, options: {
        keepalive?: boolean;
        visibilityOverride?: 'private' | 'public';
        cloudSync?: boolean; // Tiered Sync Flag
    } = {}) => {
        // ... (existing logic, ensured to check isOwner below)
        if (isReadOnly) return;

        const { keepalive = false, visibilityOverride } = options;

        const settings = useAppStore.getState();

        const slotName = currentSlotIdRef.current
            ? (SaveManager.getMeta(currentSlotIdRef.current)?.name ?? 'Untitled')
            : 'Untitled';

        const isFirstCloudSync = isCloud && !hasSyncedRef.current;

        // AUTO-CANCEL: If we are manually saving or a timer is firing, clear all other pending save calls
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

        // 1. Serialize Current State
        let encoded = '';
        try {
            const nodes = Array.from(brain.getNodesMap().values());
            const currentData: any = {
                nodes: nodes.map(n => {
                    // [V4.0] Lean Payload: Prune redundant UI metadata from data object
                    const {
                        handles,
                        measured,
                        selected,
                        dragging,
                        visualTick, // These are local-only animations
                        ...leanData
                    } = (n.data || {}) as any;

                    return {
                        id: n.id,
                        type: n.type || 'io:val',
                        position: n.position,
                        data: leanData,
                        parentId: n.parentId,
                        width: n.width !== undefined ? Math.round(n.width) : undefined,
                        height: n.height !== undefined ? Math.round(n.height) : undefined
                    };
                }),
                edges: brain.getEdges().map(e => ({
                    id: e.id,
                    source: e.source,
                    sourceHandle: e.sourceHandle || '',
                    target: e.target,
                    targetHandle: e.targetHandle || '',
                    type: e.type
                    // Omitted e.data for V4.0 Lean Sync to ensure network efficiency
                })),
                version: '1.0.0'
                // [V4.0] Omitted 'settings' and 'viewport' as per user request to reduce payload bloat.
            };
            encoded = Serializer.serializeData(currentData);
        } catch (e) {
            console.error("[useProjectSave] Serialization Error:", e);
            return;
        }

        // TIER 0 CLOUD-FIRST DEDUPLICATION: If we match the Cloud, we are "Perfectly Safe"
        // Even if we skip local backup, it is fine because Cloud is the source of truth.
        if (hasSyncedRef.current && encoded === lastSyncedPayloadRef.current) {
            console.log("[useProjectSave] Data matches current Cloud state. Skipping all writes.");
            setSaveStatus('CLOUD_SYNCED');
            setIsCloudDirty(false);
            return;
        }

        // TIER 1 DEDUPLICATION: Skip local backup only if on-disk data is already identical
        if (encoded === lastLocalSavePayloadRef.current) {
            // Already matched local disk. Maybe still need Tier 2 cloud sync later.
        } else {
            try {
                // [V3.0] Persist current hash to disk for durability
                const id = SaveManager.saveFromRaw(
                    slotName,
                    encoded,
                    settings as unknown as Record<string, unknown>,
                    currentSlotIdRef.current || (isCloud ? `cloud:${actualId}` : undefined)
                );

                // Clarify log: this is a local save to a cloud-prefixed slot
                console.log(`[useProjectSave] Local backup updated ${isCloud ? '(Cloud Slot)' : ''}. Slot: ${id}. Size: ${Math.round(encoded.length / 1024)}KB`);
                currentSlotIdRef.current = id;
                lastLocalSavePayloadRef.current = encoded; // Update local baseline

                // ONLY show local toast if it's strictly a local project
                if (!isCloud && !silent) toast.success('Project saved locally!');

                // Mark as locally saved first - this is our baseline safety
                setSaveStatus('LOCAL_SAVED');
            } catch (e) {
                console.error("Local Backup Save Error:", e);
                if (!isCloud) {
                    setSaveStatus('ERROR');
                    return;
                }
            }
        }

        // TIERED PROMOTION: If logged in, prioritize cloud sync.
        // TIER 1 (Local Backup): cloudSync = false (Used by 10s auto-save)
        // TIER 2 (Full Sync): cloudSync = true (Used by 10m sync, manual Ctrl+S, exit)
        const effectiveIsCloud = isCloud || (!!session && actualId !== 'new');
        const shouldSyncToCloud = effectiveIsCloud && options.cloudSync !== false;

        if (shouldSyncToCloud) {
            if (!session) {
                if (!silent) toast.error('Cloud sync unavailable', {
                    description: 'Local backup updated. Please sign in to sync with Cloud.'
                });
                return;
            }

            // Ensure our state tracks this elevation
            if (!isCloud) setIsCloud(true);

            // NEW: Explicit Sync Telemetry
            console.log(`[useProjectSave] saveProject triggered. isCloud:${isCloud}, hasSynced:${hasSyncedRef.current}, online:${navigator.onLine}`);

            try {
                // HARDWARE CHECK: Verify physical network connection
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    console.log("[useProjectSave] Device is offline, skipping cloud sync.");
                    throw new Error("OFFLINE_BACKUP_ONLY");
                }

                // PAYLOAD DEDUPLICATION: Don't sync if the cloud is already up to date
                // CRITICAL: Only skip if we have already successfully reached the cloud in this session (hasSyncedRef.current)
                if (hasSyncedRef.current && encoded === lastSyncedPayloadRef.current) {
                    console.log("[useProjectSave] Tier 2: Cloud matches local. Skipping upload.");
                    setSaveStatus('CLOUD_SYNCED');
                    setIsCloudDirty(false); // Clean!
                    return;
                }

                console.log(`[useProjectSave] Starting Network Handshake (${actualId})...`);

                const method = isFirstCloudSync ? "POST" : "PUT";
                const url = isFirstCloudSync ? "/api/graphs" : `/api/graphs/${actualId}`;
                const title = slotName || ("Cloud Graph " + new Date().toLocaleDateString());

                const payload = {
                    payload: encoded,
                    title,
                    id: actualId,
                    nodeCount: brain.getNodesMap().size,
                    edgeCount: brain.getEdges().length,
                    visibility: visibilityOverride || existingVisibility || projectMeta?.visibility
                };

                let response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store', // FORCE real network handshake, skip browser cache
                    body: JSON.stringify(payload),
                    keepalive // Bulletproof sync on exit/tab-switch
                });

                // FALLBACK: If PUT failed with 404, the project was created offline. Retry with POST.
                if (!isFirstCloudSync && response.status === 404) {
                    console.log(`[useProjectSave] Project ${actualId} not found on server (404). Attempting POST creation.`);
                    response = await fetch("/api/graphs", {
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                }

                if (!response.ok) {
                    const data = await response.json().catch(() => ({ error: 'Sync failed' }));
                    if (data.error?.includes('Graph limit reached')) {
                        throw new Error("LIMIT_REACHED: " + data.error);
                    }
                    throw new Error(data.error || "Failed to sync to cloud");
                }

                const result = await response.json().catch(() => ({}));
                if (result.visibility) {
                    setProjectMeta(prev => prev ? { ...prev, visibility: result.visibility } : result);
                }

                // Cleanup: If this was a "New" project that just got its first Cloud ID, remove the temp local backup
                if (isFirstCloudSync && tempNewIdRef.current) {
                    console.log(`[useProjectSave] First cloud sync successful. Cleaning up temp buffer: ${tempNewIdRef.current}`);
                    SaveManager.delete(tempNewIdRef.current);
                    tempNewIdRef.current = null;
                }

                // SUCCESS: Cloud is confirmed
                hasSyncedRef.current = true;
                lastSyncedPayloadRef.current = encoded;
                lastLocalSavePayloadRef.current = encoded; // Cloud success also satisfies local backup baseline
                setIsCloudDirty(false); // Clean!

                const storageId = `cloud:${actualId}`;
                SaveManager.updateMeta(storageId, { syncStatus: 'synced' });

                console.log("[useProjectSave] Network Handshake Finished. Cloud synced.");
                setSaveStatus('CLOUD_SYNCED');
                if (!silent) toast.success('Cloud Synced ️');

            } catch (e: any) {
                console.warn("Cloud Sync Failed (Local copy is safe):", e);
                setSaveStatus('PENDING_SYNC');

                // Mark as pending in local index
                const storageId = `cloud:${actualId}`;
                SaveManager.updateMeta(storageId, { syncStatus: 'pending' });

                if (!silent) {
                    if (e.message?.includes('limit reached')) {
                        toast.error('Cloud Space Full (10/10)', {
                            description: 'You have reached the cloud project limit. Please delete an old project to sync this one.',
                            duration: 10000
                        });
                    } else if (e.message === 'OFFLINE_BACKUP_ONLY') {
                        toast.info('Offline Backup Saved', {
                            description: 'You are offline. Your work is saved locally and will sync when you reconnect.'
                        });
                    } else {
                        toast.warning('Sync Pending (Network Error)', {
                            description: 'Local backup updated, but could not reach server. We will auto-sync when possible.'
                        });
                    }
                }
            }
        } else {
            // Local-only project (No Session OR actualId='new')
            setSaveStatus('LOCAL_SAVED');
            // Update baseline even for local so 10s auto-save is efficient
            lastSyncedPayloadRef.current = encoded;
        }

    }, [isCloud, actualId, session, brain, isReadOnly, existingVisibility, projectMeta?.visibility]);

    const resetCloudTimer = useCallback(() => {
        if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);

        // Internal auto-sync helper
        const syncIfDirty = async () => {
            if (!isCloudDirty || isReadOnly) {
                // If not dirty, just reschedule the next check
                cloudTimerRef.current = setTimeout(syncIfDirty, 600000); // 10 mins
                return;
            }

            // Perform serialization comparison only when the timer hits (performance)
            const settings = useAppStore.getState();
            const nodes = Array.from(brain.getNodesMap().values());
            const edges = brain.getEdges().map(e => ({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle || '',
                target: e.target,
                targetHandle: e.targetHandle || '',
                type: e.type,
                data: e.data as any
            }));

            const currentData: any = {
                nodes: nodes.map(n => ({
                    id: n.id,
                    type: n.type || 'io:val',
                    position: n.position,
                    data: n.data,
                    parentId: n.parentId
                })),
                edges: edges,
                settings: settings as any
            };
            const currentPayload = Serializer.serializeData(currentData);

            if (currentPayload === lastSyncedPayloadRef.current) {
                setIsCloudDirty(false);
                cloudTimerRef.current = setTimeout(syncIfDirty, 600000);
                return;
            }

            console.log("[useProjectSave] Tier 2 (Full Sync): 10-minute auto-sync triggered.");
            await saveProject(true, { cloudSync: true });

            // Reschedule regardless of success (saveProject updates isCloudDirty on success)
            cloudTimerRef.current = setTimeout(syncIfDirty, 600000);
        };

        cloudTimerRef.current = setTimeout(syncIfDirty, 600000); // 10 mins
    }, [isCloudDirty, isReadOnly, brain, saveProject]);

    // Initial Sync Setup & Content Capture
    useEffect(() => {
        if (isLoaded && !isReadOnly) {
            // Capture initial state to lastSyncedPayloadRef after injection finishes
            const settings = useAppStore.getState();
            const nodes = Array.from(brain.getNodesMap().values());
            const edges = brain.getEdges().map(e => ({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle || '',
                target: e.target,
                targetHandle: e.targetHandle || '',
                type: e.type,
                data: e.data as any
            }));

            const initialData: any = {
                nodes: nodes.map(n => ({
                    id: n.id,
                    type: n.type || 'io:val',
                    position: n.position,
                    data: n.data,
                    parentId: n.parentId
                })),
                edges: edges,
                settings: settings as any
            };
            lastSyncedPayloadRef.current = Serializer.serializeData(initialData);

            resetCloudTimer();
        }
        return () => {
            if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
        };
    }, [isLoaded, isReadOnly, brain, resetCloudTimer]);

    const forkProject = useCallback(async (targetType: 'cloud' | 'local' = 'cloud') => {
        const settings = useAppStore.getState();
        const title = `Copy of ${projectMeta?.title || 'Untitled'}`;

        if (targetType === 'cloud') {
            if (!session) {
                toast.error('Login required to fork to Cloud');
                return;
            }
            try {
                const newId = SaveManager.save(title, brain, settings as unknown as Record<string, unknown>);
                const encoded = SaveManager.getRawData(newId)!;

                const response = await fetch('/api/graphs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        payload: encoded,
                        title,
                        nodeCount: brain.getNodesMap().size,
                        edgeCount: brain.getEdges().length,
                        visibility: 'private'
                    })
                });
                if (!response.ok) throw new Error("Fork failed");
                const result = await response.json();
                toast.success('Project forked to your Cloud!');
                router.push(`/d/cloud:${result.id.replace(/^(cloud:)+/i, '')}`);
            } catch (e) {
                toast.error('Failed to fork project');
            }
        } else {
            // Re-use current newId if we already saved above?
            // Actually newId might not be available here, let's keep it simple.
            const newLocalId = SaveManager.save(title, brain, settings as unknown as Record<string, unknown>);
            toast.success('Project forked to your Local storage!');
            // Small delay to ensure localStorage write/indexing is finished before navigation
            setTimeout(() => {
                router.push(`/d/${newLocalId}`);
            }, 100);
        }
    }, [brain, projectMeta, session, router]);

    // Refactored Reliable Auto-Save Object for Interface Compatibility
    const autoSave = useMemo(() => {
        return {
            trigger: () => {
                if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
                autoSaveTimerRef.current = setTimeout(() => {
                    console.log("[useProjectSave] Tier 1 (Local Backup): 10-second auto-save triggered.");
                    saveProject(true, { cloudSync: false }); // Local backup only
                    setIsCloudDirty(true); // Still dirty for cloud sync (10m)
                }, 10000);
            },
            cancel: () => {
                if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [saveProject]);

    useEffect(() => {
        return () => {
            autoSave.cancel();
        };
    }, [autoSave]);

    const triggerDirty = useCallback(() => {
        if (!isReadOnly) {
            // Layer 1: Immediate UI Feedback (Orange Warning)
            setSaveStatus('DIRTY'); // Local React state
            setIsCloudDirty(true);

            // Layer 2: Stable Debounce
            autoSave.trigger();
        }
    }, [isReadOnly, autoSave]);

    // NEW: Proactive Brain Listener for Data Changes (e.g. Sliders)
    useEffect(() => {
        if (isReadOnly) return;

        const unsubscribe = brain.on('transactionApplied', (tx: any) => {
            // Only trigger if the transaction actually changes graph state
            // and NOT if it's already in the middle of being resolved or purely visual
            if (tx.type === 'MOVE_NODE') return;

            console.log("[useProjectSave] Transaction detected, dirtying project status.");
            triggerDirty();
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, [brain, isReadOnly, triggerDirty]);

    const loadProject = useCallback((encoded: string) => {
        const data = Serializer.deserialize(encoded);
        if (!data) {
            toast.error('Failed to load project from data');
            return;
        }

        if (data.settings) restoreSettings(data.settings);

        const graphToInject = (data as any).graph || { nodes: data.nodes, edges: data.edges };
        if (graphToInject.nodes) {
            brain.injectNodes(graphToInject, true).then(() => {
                toast.success('Project loaded successfully');
                fitViewToScene({ duration: 400 });
            });
        }
    }, [fitViewToScene, brain]);
    // Initial Load — delayed to ensure useBrainUpdates listener is registered first
    useEffect(() => {
        // RELOAD GUARD: Prevent re-running logic if the project is already loaded and ID hasn't changed.
        // This solves the status update flickering on tab switch or session re-validation.
        if (isLoaded && prevIdRef.current === actualId) {
            return;
        }

        const { setSaveStatus } = useAppStore.getState();
        setIsLoaded(false);
        prevIdRef.current = actualId;

        const rafId = requestAnimationFrame(async () => {
            const isBrandNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1';

            // 1. BRAND NEW PROJECT LOGIC
            if (actualId === 'new' || isBrandNew) {
                console.log(`[useProjectSave] Brand new project detected (${actualId === 'new' ? 'ID:new' : 'URL:new'}).`);
                hasSyncedRef.current = false;
                setIsCloud(false);

                if (session?.user?.id) {
                    setProjectMeta({
                        title: 'Untitled Project',
                        visibility: 'private',
                        userId: session.user.id
                    });
                }

                await brain.injectNodes({ nodes: [], edges: [] }, true);

                // Set initial baseline for brand new
                lastSyncedPayloadRef.current = Serializer.serializeData({ nodes: [], edges: [], settings: useAppStore.getState() });

                setSaveStatus('SAVED');
                setIsLoaded(true);
                return;
            }

            // 2. LOAD DATA HELPER (Strict Sequence)
            const loadGraphData = async (sourceData: any, sourceTag: 'CLOUD' | 'LOCAL') => {
                if (!sourceData) return;

                if (sourceData.settings) restoreSettings(sourceData.settings);
                const graph = (sourceData as any).graph || { nodes: sourceData.nodes, edges: sourceData.edges };

                if (graph.nodes) {
                    console.log(`[useProjectSave] Injecting ${sourceTag} graph...`);
                    await brain.injectNodes(graph, true, true);

                    // Step 4 & 5: Baseline and Reveal
                    lastSyncedPayloadRef.current = Serializer.serializeData({
                        nodes: graph.nodes,
                        edges: graph.edges,
                        settings: useAppStore.getState()
                    });

                    setSaveStatus(sourceTag === 'CLOUD' ? 'CLOUD_SYNCED' : 'LOCAL_SAVED');
                    fitViewToScene({ duration: 0 });
                    revealAfterPaint();
                } else {
                    setIsLoaded(true);
                }
            };

            // 3. PROACTIVE CLOUD DETECTION
            const shouldTryCloud = isCloud || (!!sessionUserId && actualId !== 'new');

            if (shouldTryCloud) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const res = await fetch(`/api/graphs/${actualId}`, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (res.ok) {
                        const cloudData = await res.json();
                        setIsCloud(true); // Elevate to cloud mode

                        if (cloudData.payload) {
                            const parsedCloud = Serializer.deserialize(cloudData.payload);
                            const cloudUpdatedAt = new Date(cloudData.updatedAt).getTime();
                            const localMeta = currentSlotIdRef.current ? SaveManager.getMeta(currentSlotIdRef.current) : undefined;

                            // CONFLICT RESOLUTION
                            if (localMeta && (localMeta.updatedAt - cloudUpdatedAt) > 5000) {
                                toast('⚠️ Version Conflict Detected', {
                                    description: 'Local backup is newer than Cloud version.',
                                    duration: Infinity,
                                    action: {
                                        label: 'Load Local',
                                        onClick: () => loadGraphData(SaveManager.load(currentSlotIdRef.current!), 'LOCAL')
                                    },
                                    cancel: {
                                        label: 'Use Cloud',
                                        onClick: () => loadGraphData(parsedCloud, 'CLOUD')
                                    }
                                });
                            } else {
                                await loadGraphData(parsedCloud, 'CLOUD');
                            }

                            setProjectMeta({
                                title: cloudData.title,
                                visibility: cloudData.visibility || 'private',
                                userId: cloudData.userId
                            });
                            hasSyncedRef.current = true;
                            return;
                        }
                    }
                } catch (e) {
                    console.warn("[useProjectSave] Cloud proactively check failed:", e);
                }
            }

            // 4. FALLBACK: LOCAL LOAD
            const localData = currentSlotIdRef.current ? SaveManager.load(currentSlotIdRef.current) : null;
            if (localData) {
                await loadGraphData(localData, 'LOCAL');
            } else {
                // Completely new ID that hasn't reached cloud OR local yet
                await brain.injectNodes({ nodes: [], edges: [] }, true);
                setIsLoaded(true);
            }
        });

        return () => cancelAnimationFrame(rafId);
    }, [actualId, sessionUserId, fitViewToScene, revealAfterPaint, brain]);

    // 5. STATE PROMOTION: Sync immediately when promoted to Cloud
    useEffect(() => {
        if (isCloud && !isPromotionSyncRef.current && isLoaded && !isReadOnly) {
            console.log("[useProjectSave] State Promoted to Cloud. Performing initial handshake...");
            isPromotionSyncRef.current = true;
            saveProject(true);
        }
    }, [isCloud, isLoaded, isReadOnly, saveProject]);

    // 6. REACTIVE DIRTYING: Listen for any state-changing transactions in the Brain
    useEffect(() => {
        const handleTransaction = () => {
            if (isLoaded && !isReadOnly) {
                triggerDirty();
            }
        };
        brain.on('transactionApplied', handleTransaction);
        return () => brain.off('transactionApplied', handleTransaction);
    }, [brain, isLoaded, isReadOnly, triggerDirty]);

    const updateVisibility = useCallback(async (newVisibility: 'private' | 'public') => {
        if (!isCloud) {
            toast.info('Local projects are always private. Sync to Cloud to share.');
            return;
        }
        if (isReadOnly) return;

        setProjectMeta(prev => prev ? { ...prev, visibility: newVisibility } : null);
        await saveProject(true, { visibilityOverride: newVisibility });
        toast.success(`Project is now ${newVisibility}`);
    }, [isCloud, isReadOnly, saveProject]);

    const navigateWithSave = useCallback(async (path: string) => {
        const isDirty = isCloud
            ? (isCloudDirty || saveStatus !== 'CLOUD_SYNCED')
            : (saveStatus !== 'SAVED' && saveStatus !== 'LOCAL_SAVED');

        if (isDirty && isLoaded && !isReadOnly) {
            const toastId = toast.loading('Saving changes before leaving...', { duration: Infinity });
            try {
                isNavigatingRef.current = true;
                await saveProject(true); // Force full sync (Tier 2 if cloud)
                toast.success('Changes saved!', { id: toastId, duration: 2000 });
            } catch (err) {
                console.error("[useProjectSave] Navigation save failed:", err);
                toast.error('Sync failed. Navigating anyway...', { id: toastId, duration: 3000 });
            }
        }
        isNavigatingRef.current = true;
        router.push(path);
    }, [isCloud, isCloudDirty, saveStatus, saveProject, router, isLoaded, isReadOnly]);

    // 7. HISTORY TRAP: Inject marker state once on load
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isLoaded && !isReadOnly && !isNavigatingRef.current) {
            console.log("[useProjectSave] Injecting History Lock Entry");
            window.history.pushState({ projectLocked: true }, '', window.location.href);
        }
    }, [isLoaded, isReadOnly]);

    // 8. EXIT INTERCEPTION: Listeners (Uses store.getState to avoid re-binding)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // Already navigating or read-only: no need to block
            if (!isLoaded || isReadOnly || isNavigatingRef.current) return;

            // Use getState() for real-time check without re-binding
            const store = useAppStore.getState();
            const currentDirty = isCloud
                ? (isCloudDirtyRef.current || store.saveStatus !== 'CLOUD_SYNCED')
                : (store.saveStatus !== 'SAVED' && store.saveStatus !== 'LOCAL_SAVED');

            if (currentDirty) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };

        const handlePopState = async (event: PopStateEvent) => {
            if (isNavigatingRef.current) return;

            const store = useAppStore.getState();
            const currentDirty = isCloud
                ? (isCloudDirtyRef.current || store.saveStatus !== 'CLOUD_SYNCED')
                : (store.saveStatus !== 'SAVED' && store.saveStatus !== 'LOCAL_SAVED');

            if (currentDirty && isLoaded && !isReadOnly) {
                console.log("[useProjectSave] Back button detected in dirty state. Locking.");

                // RESTORE LOCK: Use pushState to offset the browser's pop
                window.history.pushState({ projectLocked: true }, '', window.location.href);

                const toastId = toast.loading('Saving before you leave...', { duration: Infinity });
                try {
                    await saveProject(true);
                    toast.success('Saved! Redirecting...', { id: toastId, duration: 1500 });
                    isNavigatingRef.current = true;
                    setTimeout(() => router.push('/dashboard'), 500);
                } catch (err) {
                    toast.error('Sync failed, navigating anyway...', { id: toastId, duration: 2000 });
                    isNavigatingRef.current = true;
                    setTimeout(() => router.push('/dashboard'), 500);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isLoaded, isReadOnly, isCloud, saveProject, router]);

    return {
        saveProject,
        updateVisibility,
        autoSave,
        triggerDirty,
        resetCloudTimer,
        setIsCloudDirty,
        loadProject,
        currentSlotId: currentSlotIdRef,
        isLoaded,
        projectMeta,
        permissionError,
        forkProject,
        isOwner,
        isReadOnly,
        isCloudDirty,
        navigateWithSave
    };
}
