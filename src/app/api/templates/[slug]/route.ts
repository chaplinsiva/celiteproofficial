import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: Fetch template by slug
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        checkSupabaseConfig();
        const { slug } = await params;

        const { data, error } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("slug", slug)
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return NextResponse.json({ error: "Template not found" }, { status: 404 });
            }
            throw error;
        }

        return NextResponse.json({ template: data });
    } catch (error) {
        console.error("Error fetching template:", error);
        return NextResponse.json(
            { error: "Failed to fetch template", details: String(error) },
            { status: 500 }
        );
    }
}
