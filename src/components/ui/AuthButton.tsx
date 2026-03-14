'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, User } from "lucide-react";

export function AuthButton() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-900/50 border border-zinc-800">
                <div className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                <span className="animate-pulse">Loading</span>
            </div>
        );
    }

    if (session && session.user) {
        return (
            <div className="flex items-center gap-3 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-1 pr-3 transition-colors group">
                <div className="flex items-center gap-2 min-w-0">
                    {session.user.image ? (
                        <img src={session.user.image} alt={session.user.name || "User"} className="w-8 h-8 rounded-[6px] border border-zinc-700/50 shadow-sm" />
                    ) : (
                        <div className="w-8 h-8 rounded-[6px] bg-zinc-800 flex items-center justify-center border border-zinc-700/50">
                            <User className="w-4 h-4 text-zinc-400" />
                        </div>
                    )}
                    <div className="hidden lg:flex flex-col min-w-0 max-w-[120px]">
                        <span className="text-[11px] font-bold text-zinc-200 truncate leading-tight uppercase tracking-wide">{session.user.name}</span>
                        <span className="text-[9px] text-zinc-500 truncate font-mono leading-none">{session.user.email}</span>
                    </div>
                </div>

                <div className="w-px h-4 bg-zinc-800/50" />

                <button
                    onClick={() => signOut({ redirect: false })}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-red-400 transition-colors whitespace-nowrap cursor-pointer"
                    title="Sign Out"
                >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => signIn("google")}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all text-zinc-400 bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 hover:text-white cursor-pointer group shadow-sm"
        >
            <LogIn className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
            <span>Sign in with Google</span>
        </button>
    );
}
