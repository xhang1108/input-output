'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectLoadScreen } from '@/components/ui/ProjectLoadScreen';
import { VisualClock } from '@/components/VisualClock';
import { SystemHeader } from '@/components/ui/SystemHeader';

export default function Dashboard() {
    const router = useRouter();
    const [isWikiLoading, setIsWikiLoading] = useState(false);

    const handleOpenProject = useCallback((id: string) => {
        router.push(`/d/${id}`);
    }, [router]);

    const handleNewProject = useCallback((id: string = "new") => {
        router.push(`/d/${id}`);
    }, [router]);

    const handleWikiNavigate = useCallback(() => {
        setIsWikiLoading(true);
        router.push('/wiki');
    }, [router]);

    return (
        <div className="w-screen h-screen bg-black relative flex flex-col overflow-hidden">
            <SystemHeader
                isDashboard={true}
                title="Input-Output Engine"
                subtitle="SYSTEM: SELECT_PROJECT"
                onDashboardClick={() => {}}
                onWikiClick={handleWikiNavigate}
                isLoading={isWikiLoading}
            />

            <div className="flex-1 relative overflow-hidden flex flex-col">
                <VisualClock />
                
                <ProjectLoadScreen
                    onOpen={handleOpenProject}
                    onNewProject={handleNewProject}
                />
            </div>
        </div>
    );
}

