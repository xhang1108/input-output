import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import * as schema from "./db/schema";
import { getDb } from "./db/setup";
import type { DefaultSession } from 'next-auth';

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
        } & DefaultSession["user"];
    }
}

/**
 * NextAuth v5 Configuration for Input-Output
 * Optimized for:
 * 1. Cloudflare D1 (Pages/Workers)
 * 2. Local development (Node.js/next dev)
 */

// Note: NextAuth v5 beta requires a static config object. 
const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;
const providers = [];

if (googleId && googleSecret && googleSecret.trim().length > 0) {
    providers.push(GoogleProvider({
        clientId: googleId,
        clientSecret: googleSecret,
    }));
} else {
    if (process.env.NODE_ENV === "development") {
        console.warn("Auth: Google Client ID or Secret is missing or empty. Social login disabled.");
    }
}

let adapter;
try {
    const db = getDb();
    if (db) {
        adapter = DrizzleAdapter(db);
    }
} catch (e) {
    if (process.env.NODE_ENV === "development") {
        console.log("Auth: Running in JWT-only mode (No DB binding/fallback found locally).");
    } else {
        console.error("Auth: Adapter init failed", e);
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter,
    providers,
    session: {
        strategy: adapter ? "database" : "jwt",
        maxAge: 30 * 24 * 60 * 60,
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
    callbacks: {
        async jwt({ token, user, account }) {
            // Capture immutable provider ID on first login
            if (account?.providerAccountId) {
                token.id = account.providerAccountId;
                console.log("Auth: JWT - New Login Captured:", token.id);
            } else if (!token.id) {
                // Fallback to sub or user.id
                token.id = token.sub || (user as any)?.id;
            }
            // Ensure we return a plain object
            return token;
        },
        async session({ session, token }) {
            // Defensively construct a brand new plain object for the client
            // Next.js 16 (Turbopack) is extremely sensitive to non-serializable data in RSC/Flight stream
            const userId = (token.id || session.user?.id || token.sub) as string;
            
            console.log("Auth: Session Active for User ID:", userId);

            return {
                expires: session.expires,
                user: {
                    id: userId,
                    name: session.user?.name || null,
                    email: session.user?.email || null,
                    image: session.user?.image || null,
                }
            };
        },
    },
    debug: false,
});

export async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user;
}
