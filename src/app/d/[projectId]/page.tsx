'use client';

import React, { use, useState } from 'react';
import { Body } from '@/components/Body';
import { VisualClock } from '@/components/VisualClock';
import { Forbidden } from '@/components/ui/Forbidden';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BrainProvider } from '@/context/BrainContext';

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId: rawId } = use(params);
    const projectId = decodeURIComponent(rawId);
    const { data: session } = useSession();
    const [projectMeta, setProjectMeta] = useState<{ title: string; visibility: 'private' | 'public'; userId: string } | null>(null);
    const [isForbidden, setIsForbidden] = useState(false);
    const router = useRouter();
    
    const isCloud = projectId.startsWith('cloud:');
    const isOwner = !projectMeta || !session?.user?.id || projectMeta.userId === session.user.id;
    const canShare = isCloud && projectId !== 'new';

    const handleBackToProjects = () => {
        router.push('/dashboard');
    };

    if (isForbidden) {
        return <Forbidden onBack={handleBackToProjects} />;
    }

    return (
        <BrainProvider session="main">
            <div className="w-screen h-screen bg-bg-deep relative flex flex-col overflow-hidden">
                <div className="fixed inset-0 pointer-events-none bg-grid-dots" />
                <div className="flex-1 relative overflow-hidden flex flex-col">
                    <VisualClock />
                    <Body
                        projectId={projectId}
                        onBackToProjects={handleBackToProjects || (() => {})}
                        onProjectLoaded={setProjectMeta}
                        onForbidden={() => setIsForbidden(true)}
                        visibility={projectMeta?.visibility}
                    />
                </div>
            </div>
        </BrainProvider>
    );
}
