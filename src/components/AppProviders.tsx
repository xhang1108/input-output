'use client';

import { useState, useEffect } from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { ReactFlowProvider } from '@xyflow/react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

/**
 * AppProviders
 * 
 * 核心解決方案：使用 Mounting Guard 避開 RSC 序列化漏洞。
 * 在服務端渲染期間，不掛載任何可能包含非純對象（如 Set/Map）的三方 Provider。
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 確保 Hook 在所有渲染中始終以相同順序調用
    usePerformanceMonitor();

    // 服務端/首屏水合前：只渲染子節點內容，不打包任何三方 Provider
    // 這防止了 React Flow 或 Sonner 的內部狀態物件被序列化到客戶端
    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ReactFlowProvider>
            <SonnerToaster position="top-center" richColors theme="dark" closeButton />
            {children}
        </ReactFlowProvider>
    );
}
