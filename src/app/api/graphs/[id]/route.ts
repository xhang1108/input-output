import { requireAuth } from "@/auth";
import { getGraphById, updateGraph, deleteGraph } from "@/db/queries";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        const graph = await getGraphById(user.id, id);

        if (!graph) {
            return NextResponse.json({ error: "Graph not found" }, { status: 404 });
        }

        return NextResponse.json(graph);
    } catch (error: any) {
        console.error("GET /api/graphs/[id] error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;
        const body = await req.json();
        const { payload, title, nodeCount, edgeCount } = body;

        const updatedGraph = await updateGraph(user.id, id, payload, title, nodeCount, edgeCount);

        if (!updatedGraph) {
            return NextResponse.json({ error: "Graph not found or no permission" }, { status: 404 });
        }

        return NextResponse.json(updatedGraph);
    } catch (error: any) {
        console.error("PUT /api/graphs/[id] error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const deletedGraph = await deleteGraph(user.id, id);

        if (!deletedGraph) {
            return NextResponse.json({ error: "Graph not found or no permission" }, { status: 404 });
        }

        return NextResponse.json({ success: true, id: deletedGraph.id });
    } catch (error: any) {
        console.error("DELETE /api/graphs/[id] error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
