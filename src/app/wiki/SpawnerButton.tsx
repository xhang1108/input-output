"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Package, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface SpawnerButtonProps {
    label?: string;
    iogl: string; // The IOGL JSON string to inject
}

export const SpawnerButton: React.FC<SpawnerButtonProps> = ({ label = "Try Example", iogl }) => {
    const router = useRouter();

    const handleSpawn = () => {
        try {
            // Validate JSON before saving
            JSON.parse(iogl);

            // Store for the main canvas to pick up
            localStorage.setItem('pending_example_iogl', iogl);

            // Notify user and navigate
            toast.success("Example ready! Navigating to canvas...");

            // Navigate back to project view (assuming '/' is dashboard where user picks/loads projects)
            // Or directly to the last project if we want to be aggressive.
            // For now, let's go to the root.
            router.push('/');

        } catch (e) {
            toast.error("Failed to parse example data.");
            console.error(e);
        }
    };

    return (
        <button
            onClick={handleSpawn}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs transition-all uppercase tracking-widest active:scale-95 my-6 border border-white/10 shadow-lg shadow-blue-900/20 group cursor-pointer"
        >
            <Package size={14} className="group-hover:rotate-12 transition-transform" />
            {label}
            <ExternalLink size={10} className="opacity-50" />
        </button>
    );
};
