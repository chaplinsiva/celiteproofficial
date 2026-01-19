import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("projects")
            .select(`
                *,
                template:templates (
                    title,
                    thumbnail_url,
                    slug
                )
            `)
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ projects: data });
    } catch (error) {
        console.error("Project fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, userId, templateId, name, configuration } = body;

        if (!userId || !templateId || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        if (id) {
            // Update existing project
            const { data, error } = await supabaseAdmin
                .from("projects")
                .update({
                    name,
                    configuration,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .eq("user_id", userId)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, project: data });
        } else {
            // Create new project
            const { data, error } = await supabaseAdmin
                .from("projects")
                .insert({
                    user_id: userId,
                    template_id: templateId,
                    name,
                    configuration
                })
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ success: true, project: data });
        }
    } catch (error) {
        console.error("Project save error:", error);
        return NextResponse.json({ error: "Failed to save project" }, { status: 500 });
    }
}
