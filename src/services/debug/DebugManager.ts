import { GraphCodec } from '@/engine/GraphCodec';
import { useAppStore } from '@/store/useStore';
import { APP_VERSION } from '@/lib/version';
import { isBenignBrowserError } from '@/utils/browserErrors';

interface DebugLog {
    timestamp: number;
    level: 'log' | 'warn' | 'error';
    message: string;
}

class DebugManager {
    private static instance: DebugManager;
    private logs: DebugLog[] = [];
    private maxLogs = 100;
    private originalConsole: Partial<Console> = {};

    private constructor() {
        this.setupListeners();
        this.interceptConsole();
    }

    public static getInstance(): DebugManager {
        if (!DebugManager.instance) {
            DebugManager.instance = new DebugManager();
        }
        return DebugManager.instance;
    }

    private setupListeners() {
        if (typeof window === 'undefined') return;

        window.onerror = (message, source, lineno, colno, error) => {
            const text = String(message);

            // Browsers report a ResizeObserver backlog as a window error even
            // though the layout is correct. It happens while resizing nodes
            // that React Flow measures, so it must not show the crash overlay.
            if (isBenignBrowserError(text)) {
                this.addLog('warn', `Ignored: ${text}`);
                return;
            }

            const msg = `Global Error: ${text} at ${String(source)}:${String(lineno)}:${String(colno)}`;
            this.addLog('error', msg);
            this.showCrashOverlay(msg);
        };

        window.onunhandledrejection = (event) => {
            const text = String(event.reason);
            if (isBenignBrowserError(text)) {
                this.addLog('warn', `Ignored: ${text}`);
                return;
            }

            const msg = `Unhandled Rejection: ${text}`;
            this.addLog('error', msg);
            this.showCrashOverlay(msg);
        };
    }

    private interceptConsole() {
        if (typeof window === 'undefined') return;
        
        const levels: ('log' | 'warn' | 'error')[] = ['log', 'warn', 'error'];
        
        levels.forEach(level => {
            this.originalConsole[level] = console[level];
            console[level] = (...args: any[]) => {
                const message = args.map(arg => {
                    try {
                        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
                    } catch {
                        return String(arg);
                    }
                }).join(' ');
                
                this.addLog(level, message);
                this.originalConsole[level]?.apply(console, args);
            };
        });
    }

    private addLog(level: 'log' | 'warn' | 'error', message: string) {
        this.logs.push({
            timestamp: Date.now(),
            level,
            message
        });

        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // BroadCast for UI updates if needed
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('input-output-debug-log', { detail: { level, message } }));
        }
    }

    public trackWorkerError(error: any) {
        const errorMsg = typeof error === 'string' ? error : JSON.stringify(error);
        this.addLog('error', `Worker Error: ${errorMsg}`);
        this.showCrashOverlay(errorMsg);
    }

    private showCrashOverlay(message: string = 'System Crash Detected') {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('input-output-crash', { detail: { message } }));
    }

    public getLogs() {
        return this.logs;
    }

    public generateDebugBundle() {
        if (typeof window === 'undefined') return JSON.stringify({ error: 'Cannot generate bundle on server' });

        const bundle = {
            version: APP_VERSION,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            logs: this.logs,
            actionLog: useAppStore.getState().actionLog,
            // graph: collected separately or via store
        };

        return JSON.stringify(bundle, null, 2);
    }
}

export const debugManager = DebugManager.getInstance();

