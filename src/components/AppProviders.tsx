'use client';

import { useState, useEffect } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { ReactFlowProvider } from '@xyflow/react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { NextAuthProvider } from './NextAuthProvider';

/**
 * AppProviders
 * Standard wrapping for Next.js 16.
 * Mounting guard moved deeper into InternalProviders to protect side-effect components only.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <NextAuthProvider>
            <ReactFlowProvider>
                <InternalProviders>{children}</InternalProviders>
            </ReactFlowProvider>
        </NextAuthProvider>
    );
}

function InternalProviders({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    usePerformanceMonitor();

    // During SSR, we render children as-is.
    // Client-only side-effect components (Toaster) are added after mount.
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <>
            <SonnerToaster position="top-center" richColors theme="dark" closeButton />
            {children}
        </>
    );
}
