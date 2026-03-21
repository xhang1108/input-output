export const dynamic = 'force-dynamic';

import { requireAuth } from "@/auth";
import { getUserGraphs, createGraph } from "@/db/queries";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const graphs = await getUserGraphs(user.id);
        console.log("GET /api/graphs for User ID:", user.id);
        console.log("Found graphs:", graphs.length);

        return NextResponse.json(graphs);
    } catch (error: any) {
        console.error("GET /api/graphs error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { payload, title, id, createdAt, updatedAt, nodeCount, edgeCount, visibility } = body;

        if (payload === undefined || payload === null || typeof payload !== "string") {
            return NextResponse.json({ error: "Missing or invalid payload" }, { status: 400 });
        }

        const newGraph = await createGraph(
            user.id, 
            payload, 
            title, 
            id,
            createdAt ? new Date(createdAt) : undefined,
            updatedAt ? new Date(updatedAt) : undefined,
            nodeCount,
            edgeCount,
            visibility
        );

        return NextResponse.json(newGraph, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/graphs error:", error);
        if (error.message?.includes("Graph limit reached")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
