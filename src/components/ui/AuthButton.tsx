'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, User } from "lucide-react";

export function AuthButton() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <button disabled className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-500 bg-zinc-900/50">
                <div className="w-4 h-4 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />
                <span className="animate-pulse">Loading...</span>
            </button>
        );
    }

    if (session && session.user) {
        return (
            <div className="flex flex-col gap-1 w-full bg-zinc-950/50 rounded-lg p-2 border border-zinc-800">
                <div className="flex items-center gap-3 px-2 py-1 mb-1">
                    {session.user.image ? (
                        <img src={session.user.image} alt={session.user.name || "User"} className="w-6 h-6 rounded-full border border-zinc-700" />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                            <User className="w-3 h-3 text-zinc-400" />
                        </div>
                    )}
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <span className="text-xs font-semibold text-zinc-300 truncate">{session.user.name}</span>
                        <span className="text-[10px] text-zinc-500 truncate">{session.user.email}</span>
                    </div>
                </div>

                <button
                    onClick={() => signOut({ redirect: false })}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors w-full text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/20"
                >
                    <LogOut className="w-3 h-3" />
                    Sign Out
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => signIn("google")}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-zinc-200 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 shadow-sm"
        >
            <LogIn className="w-4 h-4 text-white" />
            Sign in with Google
        </button>
    );
}
