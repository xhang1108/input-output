import { useEffect, useRef } from 'react';
import { Parser } from '../iogl/Parser';
import { SaveManager } from '../services/SaveManager';

const INIT_KEY = 'Input-Output-templates-initialized';

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
                    // Create projects from newest to oldest visually if we don't reverse them, 
                    // but SaveManager prepends/appends based on Date.now(). Let's stagger them 
                    // slightly so their createdAt timestamps order them nicely.
                    
                    for (let i = 0; i < data.templates.length; i++) {
                        const template = data.templates[i];
                        const parser = new Parser(template.content);
                        const { graph } = parser.parse();
                        
                        SaveManager.saveTemplate(template.name, graph);
                        
                        // Fake a tiny delay so timestamps are distinct for sorting
                        await new Promise(r => setTimeout(r, 10));
                    }

                    // Dispatch an event to tell the sidebar/project list to refresh its state
                    window.dispatchEvent(new Event('local-projects-updated'));
                    console.log(`[Templates] Successfully initialized ${data.templates.length} templates.`);
                }
            } catch (err) {
                console.error('[Templates] Initialization failed:', err);
                // On failure, remove the flag so it can retry next time
                localStorage.removeItem(INIT_KEY);
            }
        };

        initializeTemplates();
    }, []);
}
