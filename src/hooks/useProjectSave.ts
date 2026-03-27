import { useEffect, useCallback, useRef, useState } from 'react';
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
    if (typeof settings.edgeType === 'string') store.setEdgeType(settings.edgeType);
    if (typeof settings.layoutAlgorithm === 'string') store.setLayoutAlgorithm(settings.layoutAlgorithm as any);
}

export function useProjectSave(projectId: string, setNodes: (nds: any[] | ((prev: any[]) => any[])) => void, existingVisibility?: 'private' | 'public') {
    const { getViewport, setViewport, fitView } = useReactFlow();
    const router = useRouter();
    const brain = useBrain();
    const [isLoaded, setIsLoaded] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    const [projectMeta, setProjectMeta] = useState<{ title: string; visibility: 'private' | 'public'; userId: string } | null>(null);
    const { data: session } = useSession();

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
    const isCloud = decodedProjectId.startsWith('cloud:');

    // actualId should be the raw ID without any prefix for database lookups
    // Strip "cloud:" prefix idempotently
    const actualId = decodedProjectId ? decodedProjectId.replace(/^(cloud:)+/i, '') : 'new';

    const currentSlotIdRef = useRef<string | null>(
        (actualId === 'new') ? null : (isCloud ? `cloud:${actualId}` : actualId)
    );

    // Track if this cloud project has been synced to the DB yet
    // If it's a new UUID from the URL that wasn't previously in our list, it starts as false
    const hasSyncedRef = useRef<boolean>(true);

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

    // Helper: Focus on all nodes and select them
    const focusAndSelectAll = useCallback((options: { duration?: number } = {}) => {
        const { duration = 0 } = options;

        // Step 1: Immediate Select All
        setNodes((nds: any[]) => nds.map(n => ({ ...n, selected: true })));

        // Step 2: Ensure React Flow has processed node positions
        requestAnimationFrame(() => {
            // Step 3: Fit view with padding
            fitView({ duration, padding: 0.2, includeHiddenNodes: false });

            // Step 4: Double check after paint (handles async node measurements)
            setTimeout(() => {
                fitView({ duration: Math.max(0, duration - 100), padding: 0.2 });
            }, 100);
        });
    }, [setNodes, fitView]);

    const isOwner = !isCloud || (session?.user?.id !== undefined && projectMeta?.userId === session.user.id);
    const isReadOnly = isCloud && (session?.user?.id === undefined || (projectMeta !== null && projectMeta.userId !== session.user.id));

    const saveProject = useCallback(async (silent = false) => {
        // ... (existing logic, ensured to check isOwner below)
        if (isReadOnly) return;

        const settings = useAppStore.getState();
        const { setSaveStatus } = settings;

        setSaveStatus('SAVING');
        const encoded = Serializer.serialize(brain, settings as unknown as Record<string, unknown>);

        const slotName = currentSlotIdRef.current
            ? (SaveManager.getMeta(currentSlotIdRef.current)?.name ?? 'Untitled')
            : 'Untitled';

        const isFirstCloudSync = isCloud && !hasSyncedRef.current;

        try {
            const id = SaveManager.save(
                slotName,
                brain,
                settings as unknown as Record<string, unknown>,
                currentSlotIdRef.current || (isCloud ? `cloud:${actualId}` : undefined)
            );
            
            // Clarify log: this is a local save to a cloud-prefixed slot
            console.log(`[useProjectSave] Local backup updated ${isCloud ? '(Cloud Slot)' : ''}. Slot: ${id}. Size: ${Math.round(encoded.length / 1024)}KB`);
            currentSlotIdRef.current = id;

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

        if (isCloud) {
            if (!session) {
                if (!silent) toast.error('Cloud sync unavailable', {
                    description: 'Local backup updated. Please sign in to sync with Cloud.'
                });
                return;
            }

            // NEW: Explicit Sync Telemetry
            console.log(`[useProjectSave] saveProject triggered. isCloud:${isCloud}, hasSynced:${hasSyncedRef.current}, online:${navigator.onLine}`);

            try {
                // HARDWARE CHECK: Verify physical network connection
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    console.log("[useProjectSave] Device is offline, skipping cloud sync.");
                    throw new Error("OFFLINE_BACKUP_ONLY");
                }

                const method = isFirstCloudSync ? "POST" : "PUT";
                const url = isFirstCloudSync ? "/api/graphs" : `/api/graphs/${actualId}`;
                const title = slotName || ("Cloud Graph " + new Date().toLocaleDateString());

                const payload = {
                    payload: encoded,
                    title,
                    id: actualId,
                    nodeCount: brain.getNodesMap().size,
                    edgeCount: brain.getEdges().length,
                    visibility: existingVisibility || projectMeta?.visibility
                };

                let response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store', // FORCE real network handshake, skip browser cache
                    body: JSON.stringify(payload)
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

                // SUCCESS: Cloud is confirmed
                hasSyncedRef.current = true;
                setSaveStatus('CLOUD_SYNCED');
                
                // CRITICAL: Use correct storage ID with prefix
                const storageId = `cloud:${actualId}`;
                SaveManager.updateMeta(storageId, { syncStatus: 'synced' });

                if (!silent) toast.success('Cloud Synced ☁️');

                // Auto-transition to SAVED status for UI polish
                setTimeout(() => {
                    const currentStatus = useAppStore.getState().saveStatus;
                    if (currentStatus === 'CLOUD_SYNCED' || currentStatus === 'LOCAL_SAVED') {
                        setSaveStatus('SAVED');
                    }
                }, 2000);

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
            // Local-only project: transition to SAVED immediately
            setTimeout(() => {
                const currentStatus = useAppStore.getState().saveStatus;
                if (currentStatus === 'LOCAL_SAVED') {
                    setSaveStatus('SAVED');
                }
            }, 1000);
        }

    }, [isCloud, actualId, session, brain, isReadOnly, existingVisibility, projectMeta?.visibility]);

    const forkProject = useCallback(async (targetType: 'cloud' | 'local' = 'cloud') => {
        const settings = useAppStore.getState();
        const encoded = Serializer.serialize(brain, settings as unknown as Record<string, unknown>);
        const title = `Copy of ${projectMeta?.title || 'Untitled'}`;

        if (targetType === 'cloud') {
            if (!session) {
                toast.error('Login required to fork to Cloud');
                return;
            }
            try {
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
            const newId = SaveManager.save(title, brain, settings as unknown as Record<string, unknown>);
            toast.success('Project forked to your Local storage!');
            // Small delay to ensure localStorage write/indexing is finished before navigation
            setTimeout(() => {
                router.push(`/d/${newId}`);
            }, 100);
        }
    }, [brain, projectMeta, session, router]);

    // Debounced Auto-Save (5 seconds for Cloud Sync Safety)
    const autoSave = useDebounceCallback(() => {
        if (actualId !== 'new') {
            saveProject(true);
        }
    }, 5000);

    // Force sync on tab close / navigation
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // If it's a known project, trigger one last silent save
            if (actualId !== 'new') {
                saveProject(true);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [actualId, saveProject]);

    const loadProject = useCallback((encoded: string) => {
        const data = Serializer.deserialize(encoded);
        if (!data) {
            toast.error('Failed to load project from data');
            return;
        }

        if (data.settings) restoreSettings(data.settings);

        if (data.graph) {
            brain.injectNodes(data.graph, true).then(() => {
                toast.success('Project loaded successfully');
                focusAndSelectAll({ duration: 400 });
            });
        }
    }, [focusAndSelectAll, brain]);

    // Initial Load — delayed to ensure useBrainUpdates listener is registered first
    useEffect(() => {
        setIsLoaded(false);
        const rafId = requestAnimationFrame(() => {
            const isBrandNew = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === '1';

            if (actualId === 'new' || isBrandNew) {
                console.log(`[useProjectSave] Brand new project detected (${actualId === 'new' ? 'ID:new' : 'URL:new'}).`);
                hasSyncedRef.current = false;
                
                // NEW: Initialize metadata for ownership detection if session exists
                if (session?.user?.id) {
                    setProjectMeta({
                        title: 'Untitled Project',
                        visibility: 'private',
                        userId: session.user.id
                    });
                }
                
                brain.injectNodes({ nodes: [], edges: [] }, true).then(() => {
                    setIsLoaded(true);
                });
                return;
            }

            if (isCloud) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                // Load function helper hoisted for both cloud success & offline fallback
                const loadGraphData = (sourceData: any) => {
                    if (sourceData) {
                        if (sourceData.settings) restoreSettings(sourceData.settings);
                        if (sourceData.graph) {
                            console.log(`[useProjectSave] Injecting graph with ${sourceData.graph.nodes.length} nodes...`);
                            brain.injectNodes(sourceData.graph, true, true).then((diagnostics) => {
                                if (diagnostics && diagnostics.length > 0) {
                                    console.warn("[useProjectSave] Injection diagnostics:", diagnostics);
                                }
                                focusAndSelectAll({ duration: 0 });
                                revealAfterPaint();
                            });
                        } else {
                            console.warn("[useProjectSave] Load data found but no graph present.");
                            setIsLoaded(true);
                        }
                    } else {
                        setIsLoaded(true); // Treat missing data as blank rather than error loop
                    }
                };

                // Fetch from REST API
                fetch(`/api/graphs/${actualId}`, { signal: controller.signal })
                    .then(async res => {
                        clearTimeout(timeoutId);
                        if (!res.ok) {
                            if (res.status === 403) {
                                throw new Error("PERMISSION_DENIED");
                            }
                            if (res.status === 404) {
                                // Check for local backup before assuming it's "New"
                                // This prevents wiping unsynced projects when they are opened online
                                const localData = currentSlotIdRef.current ? SaveManager.load(currentSlotIdRef.current) : null;
                                if (localData) {
                                    console.log("[useProjectSave] Project 404 on server, but found local backup. Using backup.");
                                    hasSyncedRef.current = false;
                                    return { 
                                        payload: Serializer.serializeData(localData), 
                                        title: SaveManager.getMeta(currentSlotIdRef.current!)?.name || "Untitled",
                                        userId: session?.user?.id, // Inject current user ID to restore ownership
                                        __fromLocal: true 
                                    };
                                }
                                
                                hasSyncedRef.current = false;
                                return { __isNew: true };
                            }
                            const data = await res.json();
                            throw new Error(data.error || "Failed to load project");
                        }
                        return res.json();
                    })
                    .then(data => {
                        if (data.__isNew) {
                            if (session?.user?.id) {
                                setProjectMeta({
                                    title: 'Untitled Project',
                                    visibility: 'private',
                                    userId: session.user.id
                                });
                            }
                            brain.injectNodes({ nodes: [], edges: [] }, true).then(() => {
                                setIsLoaded(true);
                            });
                            return;
                        }

                        if (data.payload) {
                            hasSyncedRef.current = !data.__fromLocal;
                            setProjectMeta({
                                title: data.title,
                                visibility: data.visibility || 'private',
                                userId: data.userId
                            });
                            const parsedData = Serializer.deserialize(data.payload);
                            const cloudUpdatedAt = new Date(data.updatedAt).getTime();
                            const localMeta = currentSlotIdRef.current ? SaveManager.getMeta(currentSlotIdRef.current) : undefined;

                            // Conflict Resolution: Local vs Cloud
                            if (localMeta && (localMeta.updatedAt - cloudUpdatedAt) > 5000) {
                                toast('⚠️ Version Conflict Detected', {
                                    description: 'Local backup is newer. Load local or force cloud?',
                                    duration: Infinity,
                                    action: {
                                        label: 'Load Local',
                                        onClick: () => {
                                            const localData = currentSlotIdRef.current ? SaveManager.load(currentSlotIdRef.current) : null;
                                            loadGraphData(localData);
                                            toast.success("Loaded local version");
                                        }
                                    },
                                    cancel: {
                                        label: 'Force Cloud',
                                        onClick: () => {
                                            loadGraphData(parsedData);
                                            toast.info("Loaded cloud version");
                                        }
                                    }
                                });
                            } else {
                                // No conflict, load Cloud normally
                                loadGraphData(parsedData);
                            }
                        } else {
                            // Empty or new graph
                            setIsLoaded(true);
                        }
                    })
                    .catch(e => {
                        clearTimeout(timeoutId);
                        
                        // Error Recovery: If cloud fetch fails (offline/timeout), check for local backup
                        const localData = currentSlotIdRef.current ? SaveManager.load(currentSlotIdRef.current) : null;
                        if (localData) {
                            console.log("[useProjectSave] Cloud fetch failed, falling back to local copy", e);
                            loadGraphData(localData);
                            toast.info('Offline Backup Loaded', {
                                description: 'Could not reach cloud, using latest local version.'
                            });
                            return;
                        }

                        if (e.name === 'AbortError') {
                            toast.error(`Cloud fetch timed out`);
                        } else if (e.message === 'PERMISSION_DENIED') {
                            setPermissionError(true);
                            toast.error('Access Denied', {
                                description: 'This project is private. You do not have permission to view it.'
                            });
                        } else {
                            toast.error(`Failed to load cloud project: ${e.message}`);
                        }
                        setIsLoaded(true);
                    });
            } else {
                // Fetch from LocalStorage
                const data = currentSlotIdRef.current ? SaveManager.load(currentSlotIdRef.current) : null;
                if (data) {
                    if (data.settings) restoreSettings(data.settings);

                    if (data.graph) {
                        brain.injectNodes(data.graph, true, true).then(() => {
                            focusAndSelectAll({ duration: 0 });
                            revealAfterPaint();
                        });
                    } else {
                        setIsLoaded(true);
                    }
                } else {
                    // This is a brand new UUID from URL that hasn't been saved yet
                    brain.injectNodes({ nodes: [], edges: [] }, true).then(() => {
                        setIsLoaded(true);
                    });
                }
            }
        });
        return () => cancelAnimationFrame(rafId);
    }, [actualId, isCloud, focusAndSelectAll, revealAfterPaint, brain]);

    const updateVisibility = useCallback(async (newVisibility: 'private' | 'public') => {
        if (!isCloud) {
            toast.info('Local projects are always private', {
                description: 'Save this project to the Cloud to enable public sharing.'
            });
            return;
        }
        if (isReadOnly) return;

        setProjectMeta(prev => prev ? { ...prev, visibility: newVisibility } : null);
        
        // Immediate save to sync visibility
        const settings = useAppStore.getState();
        const encoded = Serializer.serialize(brain, settings as unknown as Record<string, unknown>);
        const title = projectMeta?.title || 'Untitled';

        try {
            const response = await fetch(`/api/graphs/${actualId}`, {
                method: "PUT",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: encoded,
                    title,
                    id: actualId,
                    visibility: newVisibility
                })
            });
            if (!response.ok) throw new Error("Failed to update visibility");
            toast.success(`Project is now ${newVisibility}`);
        } catch (e) {
            toast.error('Failed to sync visibility to cloud');
        }
    }, [isCloud, isReadOnly, actualId, brain, projectMeta?.title]);

    return {
        saveProject,
        updateVisibility,
        autoSave,
        loadProject,
        currentSlotId: currentSlotIdRef,
        isLoaded,
        projectMeta,
        permissionError,
        forkProject,
        isOwner,
        isReadOnly
    };
}
