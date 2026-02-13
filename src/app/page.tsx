'use client';

import { Body } from '@/components/Body';

import { ModeSwitcher } from '../components/ModeSwitcher';

export default function Home() {
    return (
        <div className="w-screen h-screen bg-black relative">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
                <ModeSwitcher />
            </div>
            <Body />
        </div>
    );
}
