'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { ReactFlowProvider } from '@xyflow/react';

export function Soul({ children }: { children: React.ReactNode }) {
    return (
        <ReactFlowProvider>
            <SonnerToaster position="top-center" richColors theme="dark" closeButton />
            {children}
        </ReactFlowProvider>
    );
}
