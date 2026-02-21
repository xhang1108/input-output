'use client';

import { useState, useCallback } from 'react';
import { Body } from '@/components/Body';
import { ProjectLoadScreen } from '@/components/ui/ProjectLoadScreen';
import { Brain } from '@/engine/Brain';

export default function Home() {
    // null = show load screen, string = active project slot id, 'new' = blank canvas (unsaved)
    const [activeProject, setActiveProject] = useState<string | null>(null);

    const handleOpenProject = useCallback((slotId: string) => {
        // Silently wipe Brain BEFORE Body mounts — prevents stale nodes from flashing
        Brain.getInstance().silentReset();
        setActiveProject(slotId);
    }, []);

    const handleNewProject = useCallback(() => {
        Brain.getInstance().silentReset();
        setActiveProject('new');
    }, []);

    const handleBackToProjects = useCallback(() => {
        setActiveProject(null);
    }, []);

    if (!activeProject) {
        return <ProjectLoadScreen onOpen={handleOpenProject} onNewProject={handleNewProject} />;
    }

    return (
        <div className="w-screen h-screen bg-black relative">
            <Body
                projectId={activeProject}
                onBackToProjects={handleBackToProjects}
            />
        </div>
    );
}
