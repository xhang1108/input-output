import { eq, and, or, desc, count } from "drizzle-orm";
import * as schema from "./schema";
import { MAX_GRAPHS_PER_USER } from "../constants/schema";
import { getDb } from "./setup";


export async function getUserGraphs(userId: string) {
    const db = getDb();
    return db.query.graphs.findMany({
        where: eq(schema.graphs.userId, userId),
        orderBy: [desc(schema.graphs.updatedAt)],
        columns: {
            payload: false // Exclude payload for lists to save bandwidth
        }
    });
}

export async function getGraphById(graphId: string) {
    const db = getDb();
    const rawId = graphId.replace(/^(cloud:)+/gi, '');
    const idWithPrefix = `cloud:${rawId}`;
    
    return db.query.graphs.findFirst({
        where: or(
            eq(schema.graphs.id, idWithPrefix),
            eq(schema.graphs.id, rawId)
        )
    });
}

export async function createGraph(
    userId: string, 
    payload: string, 
    title?: string, 
    providedId?: string,
    createdAt?: Date,
    updatedAt?: Date,
    nodeCount?: number,
    edgeCount?: number,
    visibility?: string
) {
    const db = getDb();

    // Default title from timestamp
    const defaultTitle = title || `Untitled Graph ${new Date().toLocaleDateString()}`;

    // Use provided ID or generate explicit UUIDv7
    const { v7: uuidv7 } = await import('uuid');
    const rawId = providedId ? providedId.replace(/^(cloud:)+/gi, '') : uuidv7();
    const newId = `cloud:${rawId}`;

    // Check limit ONLY if this is a truly new record (ID not in DB)
    const existingProject = await db.query.graphs.findFirst({
        where: eq(schema.graphs.id, newId)
    });

    if (!existingProject) {
        const existingCountResult = await db.select({ count: count() })
            .from(schema.graphs)
            .where(eq(schema.graphs.userId, userId));

        const currentCount = existingCountResult[0].count;

        if (currentCount >= MAX_GRAPHS_PER_USER) {
            throw new Error(`Graph limit reached (${MAX_GRAPHS_PER_USER})`);
        }
    }

    const now = new Date();
    const finalCreatedAt = createdAt || now;
    const finalUpdatedAt = updatedAt || now;

    const [inserted] = await db.insert(schema.graphs).values({
        id: newId,
        userId: userId,
        title: defaultTitle,
        payload,
        visibility: (visibility as any) || 'private',
        nodeCount: nodeCount || 0,
        edgeCount: edgeCount || 0,
        createdAt: finalCreatedAt,
        updatedAt: finalUpdatedAt
    }).onConflictDoUpdate({
        target: schema.graphs.id,
        set: {
            payload,
            title: defaultTitle,
            visibility: (visibility as any) || undefined, // undefined in Drizzle 'set' should skip the column update
            nodeCount: nodeCount || undefined,
            edgeCount: edgeCount || undefined,
            updatedAt: finalUpdatedAt
        }
    }).returning();

    return inserted;
}

export async function updateGraph(
    userId: string, 
    graphId: string, 
    payload?: string, 
    title?: string,
    nodeCount?: number,
    edgeCount?: number,
    visibility?: string
) {
    const db = getDb();
    const normalizedId = `cloud:${graphId.replace(/^(cloud:)+/gi, '')}`;

    const updateData: any = {
        updatedAt: new Date()
    };

    if (payload !== undefined) updateData.payload = payload;
    if (title !== undefined) updateData.title = title;
    if (nodeCount !== undefined) updateData.nodeCount = nodeCount;
    if (edgeCount !== undefined) updateData.edgeCount = edgeCount;
    if (visibility !== undefined) updateData.visibility = visibility;

    const [updated] = await db.update(schema.graphs)
        .set(updateData)
        .where(and(
            eq(schema.graphs.id, normalizedId),
            eq(schema.graphs.userId, userId)
        ))
        .returning();

    return updated;
}

export async function deleteGraph(userId: string, graphId: string) {
    const db = getDb();
    const rawId = graphId.replace(/^(cloud:)+/gi, '');
    const idWithPrefix = `cloud:${rawId}`;

    const [deleted] = await db.delete(schema.graphs)
        .where(and(
            or(
                eq(schema.graphs.id, idWithPrefix),
                eq(schema.graphs.id, rawId)
            ),
            eq(schema.graphs.userId, userId)
        ))
        .returning();

    return deleted;
}
