import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("projects")
            .select(`
                *,
                template:templates (*)
            `)
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (error) throw error;

        return NextResponse.json({ project: data });
    } catch (error) {
        console.error("Project fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from("projects")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Project delete error:", error);
        return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }
}
