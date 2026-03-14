import React from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowLeft, ShieldAlert } from 'lucide-react';

interface ForbiddenProps {
    onBack?: () => void;
}

export function Forbidden({ onBack }: ForbiddenProps) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="max-w-md w-full flex flex-col items-center text-center space-y-8 z-10"
            >
                {/* Shield Icon with animation */}
                <div className="relative">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="w-24 h-24 bg-zinc-900/50 border border-zinc-800 rounded-3xl flex items-center justify-center relative shadow-2xl overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-linear-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <ShieldAlert className="w-10 h-10 text-red-500/80" />
                    </motion.div>
                    
                    <motion.div 
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -inset-4 bg-red-500/10 rounded-full blur-xl -z-10"
                    />
                </div>

                <div className="space-y-3">
                    <h1 className="text-4xl font-black tracking-tighter uppercase">403 Forbidden</h1>
                    <div className="h-1 w-12 bg-red-500 mx-auto rounded-full" />
                    <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                        This project is strictly private. You don't have the clearance to view its neural architecture.
                    </p>
                </div>

                <div className="w-full pt-4 flex flex-col gap-3">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="flex items-center justify-center gap-2 w-full py-3.5 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-xl group"
                        >
                            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                            Back to Dashboard
                        </button>
                    )}
                    
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center justify-center gap-2 w-full py-3.5 bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 hover:text-white transition-all active:scale-[0.98]"
                    >
                        Retry Authorization
                    </button>
                </div>

                <div className="pt-8 flex items-center gap-2 text-[10px] text-zinc-700 font-bold uppercase tracking-[0.2em]">
                    <Lock className="w-3 h-3" />
                    <span>Security Protocol Active</span>
                </div>
            </motion.div>
        </div>
    );
}
