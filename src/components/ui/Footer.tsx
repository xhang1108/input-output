import React from 'react';
import Link from 'next/link';
import pkg from '../../../package.json';

export const Footer: React.FC = () => {
    return (
        <footer className="w-full border-t border-white/5 bg-black/20 backdrop-blur-sm px-12 py-2">
            <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-medium tracking-widest uppercase text-zinc-500">
                {/* LEFT: Website */}
                <a
                    href="https://www.nobaggage2rome.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary transition-colors duration-200"
                >
                    www.nobaggage2rome.com
                </a>

                {/* MIDDLE: Version and Copyright */}
                <div className="flex items-center gap-2">
                    <Link href="/wiki/user/system" className="group/version bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-primary/20 hover:text-primary transition-all duration-200 cursor-pointer">
                        V{pkg.version}
                    </Link>
                    <span>2026 Input-Output All Rights Reserved</span>
                </div>

                {/* RIGHT: Email */}
                <a
                    href="mailto:contact@nobaggage2rome.com"
                    className="hover:text-primary transition-colors duration-200"
                >
                    contact@nobaggage2rome.com
                </a>
            </div>
        </footer>
    );
};

