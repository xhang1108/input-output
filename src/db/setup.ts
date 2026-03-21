import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from "./schema";

// Helper for local development fallback
let localDbCache: any = null;

export function getDb() {
    // 1. Try to get Cloudflare Environment Binding
    // @ts-ignore
    const dbBinding = process.env.DB || (typeof globalThis !== 'undefined' && (globalThis as any).env?.DB);
    
    // 2. Production Edge Runtime (Must have DB)
    if (dbBinding) {
        return drizzleD1(dbBinding as D1Database, { schema });
    }

    // 3. Local Development Fallback (Next.js Node Server)
    if (process.env.NODE_ENV === "development") {
        if (!localDbCache) {
            // console.warn("⚠️ D1 Binding 'DB' not found. Falling back to local SQLite (.wrangler/state/v3/d1).");
            // Stealth require to hide Node.js modules from Edge runtime bundler
            const _req = eval('require');
            const Database = _req('better-sqlite3');
            const { drizzle: drizzleSqlite } = _req('drizzle-orm/better-sqlite3');
            const fs = _req('fs');
            const path = _req('path');
            
            const v3Dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
            let sqliteFile = '';
            
            if (fs.existsSync(v3Dir)) {
                const files = fs.readdirSync(v3Dir);
                const dbFile = files.find((f: string) => f.endsWith('.sqlite'));
                if (dbFile) {
                    sqliteFile = path.join(v3Dir, dbFile);
                }
            }

            if (!sqliteFile) {
                // Creates an in-memory or empty local.db if Wrangler hasn't generated one yet
                console.warn("Auth: Local Wrangler DB not found. Ensure you ran `wrangler d1 migrations apply io-brain-db --local`.");
                sqliteFile = path.resolve('.wrangler/local.db'); 
            }

            console.log("Auth: Using local SQLite database at:", sqliteFile);
            const sqlite = new Database(sqliteFile);
            sqlite.pragma('foreign_keys = OFF'); // Prevent NextAuth missing Local User FK constraint errors
            localDbCache = drizzleSqlite(sqlite, { schema });
        }
        return localDbCache;
    }

    throw new Error("Database binding 'DB' not found and not in development mode.");
}
