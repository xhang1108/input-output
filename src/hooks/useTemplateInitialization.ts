import { useEffect, useRef } from 'react';
import { Parser } from '@/engine/iogl/Parser';
import { SaveManager } from '../services/SaveManager';
import { Serializer } from '../engine/Serializer';

const INIT_KEY = 'Input-Output-templates-initialized-v1.2';

export function useTemplateInitialization() {
    const initializedRef = useRef(false);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const hasInitialized = localStorage.getItem(INIT_KEY);
        if (hasInitialized) return;

        // Optimistically set to prevent race conditions on strict mode double-renders
        localStorage.setItem(INIT_KEY, 'true');

        const initializeTemplates = async () => {
            try {
                const res = await fetch('/api/templates');
                if (!res.ok) throw new Error('Failed to fetch templates');
                const data = await res.json();

                if (data.success && data.templates && data.templates.length > 0) {
                    const existingProjects = SaveManager.list();

                    for (let i = 0; i < data.templates.length; i++) {
                        const template = data.templates[i];
                        const parser = new Parser(template.content);
                        const { graph } = parser.parse();

                        // Avoid duplicates: If a project with this name already exists, update its data
                        const existing = existingProjects.find(p => p.name === template.name);
                        if (existing) {
                            // Correct existing data
                            const projectData = {
                                version: Serializer.VERSION,
                                mathPrecision: 64,
                                settings: {},
                                ...graph
                            };
                            SaveManager.putRawData(existing.id, Serializer.serialize(projectData as any));
                            SaveManager.updateMeta(existing.id, {
                                nodeCount: graph.nodes.length,
                                edgeCount: graph.edges.length,
                                updatedAt: Date.now()
                            });
                            console.log(`[Templates] Updated existing template project: ${template.name}`);
                        } else {
                            SaveManager.saveTemplate(template.name, graph);
                            console.log(`[Templates] Created new template project: ${template.name}`);
                        }

                        await new Promise(r => setTimeout(r, 10));
                    }

                    window.dispatchEvent(new Event('local-projects-updated'));
                }
            } catch (err) {
                console.error('[Templates] Initialization failed:', err);
                localStorage.removeItem(INIT_KEY);
            }
        };

        initializeTemplates();
    }, []);
}

