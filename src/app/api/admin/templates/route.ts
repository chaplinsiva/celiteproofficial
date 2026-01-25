import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: List all templates
export async function GET(request: NextRequest) {
    try {
        checkSupabaseConfig();
        const { searchParams } = new URL(request.url);
        const showAll = searchParams.get("showAll") === "true";

        let query = supabaseAdmin
            .from("templates")
            .select("*")
            .order("created_at", { ascending: false });

        if (!showAll) {
            query = query.eq("is_active", true);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ templates: data });
    } catch (error) {
        console.error("Error fetching templates:", error);
        return NextResponse.json(
            { error: "Failed to fetch templates", details: String(error) },
            { status: 500 }
        );
    }
}

// POST: Create new template
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const {
            slug,
            title,
            description,
            category,
            duration,
            aspect_ratio,
            preview_url,
            thumbnail_url,
            source_url,
            image_placeholders,
            text_placeholders,
        } = body;

        if (!slug || !title) {
            return NextResponse.json(
                { error: "Slug and title are required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("templates")
            .insert({
                slug,
                title,
                description,
                category,
                duration,
                aspect_ratio,
                preview_url,
                thumbnail_url,
                source_url,
                image_placeholders,
                text_placeholders,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, template: data });
    } catch (error) {
        console.error("Error creating template:", error);
        return NextResponse.json(
            { error: "Failed to create template", details: String(error) },
            { status: 500 }
        );
    }
}
