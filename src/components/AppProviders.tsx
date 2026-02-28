'use client';

import { Toaster as SonnerToaster } from 'sonner';
import { ReactFlowProvider } from '@xyflow/react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

export function AppProviders({ children }: { children: React.ReactNode }) {
    usePerformanceMonitor();

    return (
        <ReactFlowProvider>
            <SonnerToaster position="top-center" richColors theme="dark" closeButton />
            {children}
        </ReactFlowProvider>
    );
}
