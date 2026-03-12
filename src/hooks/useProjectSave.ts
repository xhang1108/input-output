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

function restoreSettings(settings: Record<string, unknown>) {
    const store = useAppStore.getState();
    if (typeof settings.manualSnap === 'boolean') store.setManualSnap(settings.manualSnap);
    if (typeof settings.showGrid === 'boolean') store.setShowGrid(settings.showGrid);
    if (typeof settings.showDebug === 'boolean') store.setShowDebug(settings.showDebug);
    if (typeof settings.edgeType === 'string') store.setEdgeType(settings.edgeType);
    if (typeof settings.layoutAlgorithm === 'string') store.setLayoutAlgorithm(settings.layoutAlgorithm as any);
    if (typeof settings.layoutDirection === 'string') store.setLayoutDirection(settings.layoutDirection as any);
}

export function useProjectSave(projectId: string, setNodes: (nds: any[] | ((prev: any[]) => any[])) => void) {
    const { getViewport, setViewport, fitView } = useReactFlow();
    const brain = useBrain();
    const [isLoaded, setIsLoaded] = useState(false);
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

    const saveProject = useCallback(async (silent = false) => {
        const settings = useAppStore.getState();
        const encoded = Serializer.serialize(brain, settings as unknown as Record<string, unknown>);

        const slotName = currentSlotIdRef.current
                ? (SaveManager.getMeta(currentSlotIdRef.current)?.name ?? 'Untitled')
                : 'Untitled';

        const isFirstCloudSync = isCloud && !hasSyncedRef.current;

        // 核心架构原则：永远第一时间写入 LocalStorage (Instant Local)，作为终极防线
        // 对于已存在的云端专案或任何本地专案，永远无认件瞬间本地存盘。
        // 如果是全新的云专案且从未同步过，我们先跳过本地备份，等第一次同步成功拿回确认后再存，防止 ID 不一致
        if (!isFirstCloudSync) {
            try {
                const id = SaveManager.save(
                    slotName,
                    brain,
                    settings as unknown as Record<string, unknown>,
                    currentSlotIdRef.current ?? undefined
                );
                currentSlotIdRef.current = id;
                // ONLY show local toast if it's strictly a local project
                if (!isCloud && !silent) toast.success('Project saved locally!');
            } catch (e) {
                console.error("Local Backup Save Error:", e);
            }
        }

        // 如果是云端专案，额外发起网络请求去写入 D1
        if (isCloud) {
            // AUTH CHECK: Ensure user is logged in for cloud sync
            if (!session) {
                if (!silent) toast.error('Cloud sync unavailable: Authenticated session required', {
                    description: 'Please sign in to enable persistent cloud storage.'
                });
                return;
            }

            try {
                const method = isFirstCloudSync ? "POST" : "PUT";
                const url = isFirstCloudSync ? "/api/graphs" : `/api/graphs/${actualId}`;
                const title = slotName || ("Cloud Graph " + new Date().toLocaleDateString());

                const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        payload: encoded, 
                        title,
                        id: actualId // Pass our pre-generated UUID to the backend
                    })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to save to cloud");
                }

                // Success!
                hasSyncedRef.current = true;
                
                if (isFirstCloudSync) {
                    // 云端第一次同步成功，立刻补做一次 LocalStorage 本地备案
                    SaveManager.save(
                        slotName,
                        brain,
                        settings as unknown as Record<string, unknown>,
                        currentSlotIdRef.current ?? undefined
                    );
                }

                if (!silent) toast.success('Project saved to Cloud ☁️!');
            } catch (e: any) {
                if (!silent) toast.error(`Cloud save failed (Local Backup remains safe): ${e.message}`);
                console.error("Cloud Save Error:", e);
            }
        }

    }, [isCloud, actualId, session]); 

    // Debounced Auto-Save (5 seconds for Cloud Sync Safety)
    const autoSave = useDebounceCallback(() => {
        if (actualId !== 'new') {
            saveProject(true);
        }
    }, 5000);

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
            if (actualId === 'new') {
                 brain.injectNodes({ nodes: [], edges: [] }, true).then(() => {
                     setIsLoaded(true);
                 });
                return;
            }

            if (isCloud) {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                // Fetch from REST API
                fetch(`/api/graphs/${actualId}`, { signal: controller.signal })
                    .then(res => res.json())
                    .then(data => {
                        clearTimeout(timeoutId);
                        if (data.error) {
                             // If 404, it's likely a brand new cloud ID from URL that hasn't been POSTed yet
                             if (data.status === 404 || data.error.includes("not found")) {
                                 hasSyncedRef.current = false;
                                 brain.injectNodes({ nodes: [], edges: [] }, true).then(() => {
                                     setIsLoaded(true);
                                 });
                                return;
                            }
                            throw new Error(data.error);
                        }
                        if (data.payload) {
                            hasSyncedRef.current = true;
                            const parsedData = Serializer.deserialize(data.payload);
                            const cloudUpdatedAt = new Date(data.updatedAt).getTime();
                            const localMeta = currentSlotIdRef.current ? SaveManager.getMeta(currentSlotIdRef.current) : undefined;
                            
                            // Load function helper so we don't repeat the injection code
                            const loadGraphData = (sourceData: any) => {
                                if (sourceData) {
                                     if (sourceData.settings) restoreSettings(sourceData.settings);
                                     if (sourceData.graph) {
                                         brain.injectNodes(sourceData.graph, true, true).then(() => {
                                             focusAndSelectAll({ duration: 0 });
                                             revealAfterPaint();
                                        });
                                    } else {
                                        setIsLoaded(true);
                                    }
                                } else {
                                    throw new Error("Graph payload parse failed");
                                }
                            };

                            // Conflict Resolution: Local vs Cloud
                            if (localMeta && (localMeta.updatedAt - cloudUpdatedAt) > 5000) {
                                toast('⚠️ Version Conflict Detected', {
                                    description: 'Your local backup is newer than the cloud version. This usually happens if you worked offline. Which version would you like to load?',
                                    duration: Infinity,
                                    action: {
                                        label: 'Load Local Backup (Recommended)',
                                        onClick: () => {
                                            const localData = currentSlotIdRef.current ? SaveManager.load(currentSlotIdRef.current) : null;
                                            loadGraphData(localData);
                                            toast.success("Loaded newer local version");
                                        }
                                    },
                                    cancel: {
                                        label: 'Force Cloud Version',
                                        onClick: () => {
                                            loadGraphData(parsedData);
                                            toast.info("Loaded older Cloud version");
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
                        if (e.name === 'AbortError') {
                            toast.error(`Cloud fetch timed out`);
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

    return { saveProject, autoSave, loadProject, currentSlotId: currentSlotIdRef, isLoaded };
}
