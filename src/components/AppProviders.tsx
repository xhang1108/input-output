'use client';

import { useState, useEffect } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { ReactFlowProvider } from '@xyflow/react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { NextAuthProvider } from './NextAuthProvider';
import { ErrorBoundary } from './common/ErrorBoundary';
import { debugManager } from '../services/debug/DebugManager';
import { DebugOverlay } from './debug/DebugOverlay';
import { useTemplateInitialization } from '../hooks/useTemplateInitialization';

/**
 * AppProviders
 * Standard wrapping for Next.js 16.
 * Mounting guard moved deeper into InternalProviders to protect side-effect components only.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
    return (
        <ErrorBoundary>
            <NextAuthProvider>
                <ReactFlowProvider>
                    <InternalProviders>{children}</InternalProviders>
                </ReactFlowProvider>
            </NextAuthProvider>
        </ErrorBoundary>
    );
}

function InternalProviders({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [showDebugOverlay, setShowDebugOverlay] = useState(false);

    useEffect(() => {
        setMounted(true);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                setShowDebugOverlay(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    usePerformanceMonitor();
    useTemplateInitialization();

    // During SSR, we render children as-is.
    // Client-only side-effect components (Toaster) are added after mount.
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <>
            <SonnerToaster position="top-center" richColors theme="dark" closeButton />
            <DebugOverlay visible={showDebugOverlay} onClose={() => setShowDebugOverlay(false)} />
            {children}
        </>
    );
}

