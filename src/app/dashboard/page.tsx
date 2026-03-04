'use client';

import { useState, useCallback } from 'react';
import { Body } from '@/components/Body';
import { ProjectLoadScreen } from '@/components/ui/ProjectLoadScreen';
import { Brain } from '@/engine/Brain';

export default function Dashboard() {
    const [activeProject, setActiveProject] = useState<string | null>(null);

    const handleOpenProject = useCallback((slotId: string) => {
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

    return (
        <div className="w-screen h-screen bg-black relative">
            {!activeProject ? (
                <ProjectLoadScreen onOpen={handleOpenProject} onNewProject={handleNewProject} />
            ) : (
                <Body
                    projectId={activeProject}
                    onBackToProjects={handleBackToProjects}
                />
            )}
        </div>
    );
}
