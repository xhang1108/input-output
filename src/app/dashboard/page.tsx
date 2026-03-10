'use client';

import { useState, useCallback } from 'react';
import { Body } from '@/components/Body';
import { ProjectLoadScreen } from '@/components/ui/ProjectLoadScreen';
import { VisualClock } from '@/components/VisualClock';
import { Brain } from '@/engine/Brain';
import { SystemHeader } from '@/components/ui/SystemHeader';

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
        <div className="w-screen h-screen bg-black relative flex flex-col overflow-hidden">
            {!activeProject ? (
                <>
                    <SystemHeader
                        isDashboard
                        title="Input-Output Engine"
                        subtitle="SYSTEM: READY"
                    />
                    <div className="flex-1 relative overflow-hidden flex flex-col">
                        <VisualClock />
                        <ProjectLoadScreen onOpen={handleOpenProject} onNewProject={handleNewProject} />
                    </div>
                </>
            ) : (
                <div className="flex-1 relative overflow-hidden">
                    <Body
                        projectId={activeProject}
                        onBackToProjects={handleBackToProjects}
                    />
                </div>
            )}
        </div>
    );
}
