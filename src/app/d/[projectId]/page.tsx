'use client';

import { use } from 'react';
import { Body } from '@/components/Body';
import { VisualClock } from '@/components/VisualClock';
import { SystemHeader } from '@/components/ui/SystemHeader';
import { useRouter } from 'next/navigation';

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const router = useRouter();

    const handleBackToProjects = () => {
        router.push('/dashboard');
    };

    return (
        <div className="w-screen h-screen bg-black relative flex flex-col overflow-hidden">
            <div className="flex-1 relative overflow-hidden flex flex-col">
                <VisualClock />
                <Body
                    projectId={projectId}
                    onBackToProjects={handleBackToProjects}
                />
            </div>
        </div>
    );
}
