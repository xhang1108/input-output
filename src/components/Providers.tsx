'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <>
            <SonnerToaster position="top-center" richColors theme="dark" closeButton />
            {children}
        </>
    );
}
