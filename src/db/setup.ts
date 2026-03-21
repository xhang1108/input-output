import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Cache for the database instance in serverless environments
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * 💡 Database Orchestrator (Vercel + Neon Edition)
 * 
 * In Vercel's serverless/edge environment, we use the Neon HTTP driver 
 * for maximum performance and to avoid the overhead of heavy TCP connections.
 */
export function getDb() {
    if (dbInstance) return dbInstance;

    const url = process.env.DATABASE_URL;
    
    if (!url) {
        // Fallback for local development when .env.local might not be loaded yet in some test contexts
        if (process.env.NODE_ENV === "development") {
            console.error("❌ DATABASE_URL is missing in development!");
        }
        throw new Error("Missing DATABASE_URL environment variable.");
    }

    const sql = neon(url);
    dbInstance = drizzle(sql, { schema });
    
    return dbInstance;
}
