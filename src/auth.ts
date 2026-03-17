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
    console.log("Auth: Initializing adapter...");
    const db = getDb();
    console.log("Auth: DB obtained from getDb()");
    if (db) {
        adapter = DrizzleAdapter(db);
        console.log("Auth: Adapter successfully initialized with Drizzle.");
    } else {
        console.log("Auth: No DB binding found, adapter remains undefined.");
    }
} catch (e) {
    if (process.env.NODE_ENV === "development") {
        console.warn("Auth: Running in JWT-only mode (No DB binding or adapter error).", e);
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
    events: {
        async createUser({ user }) {
            console.log("Auth: Event - User Created:", user.id, user.email);
        },
        async linkAccount({ account, user }) {
            console.log("Auth: Event - Account Linked:", account.provider, "to User:", user.id);
        },
        async signIn({ user, account, profile }) {
            console.log("Auth: Event - Sign In Successful:", user?.email, "via", account?.provider);
        },
    },
    callbacks: {
        async jwt({ token, user, account, profile }) {
            console.log("Auth: JWT Callback - Account:", account?.provider);
            // Capture immutable provider ID on first login
            if (account?.providerAccountId) {
                token.id = account.providerAccountId;
                console.log("Auth: JWT - New Login Captured ID:", token.id);
            } else if (!token.id) {
                // Fallback to sub or user.id
                token.id = token.sub || (user as any)?.id;
            }
            
            if (token.id) {
                console.log("Auth: JWT token ID established:", token.id);
            }

            return token;
        },
        async session({ session, token, user }) {
            const userId = (user?.id || token?.id || session.user?.id || token?.sub) as string;
            
            console.log("Auth: Session Callback for User ID:", userId);

            if (!userId) {
                console.warn("Auth: Session Callback - No user ID found in session, token, or user object!");
            }

            return JSON.parse(JSON.stringify({
                ...session,
                user: {
                    ...session.user,
                    id: userId,
                }
            }));
        },
    },
    debug: true,
});

export async function requireAuth() {
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user;
}
