import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: Fetch single template
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        checkSupabaseConfig();
        const { id } = await params;

        const { data, error } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        return NextResponse.json({ template: data });
    } catch (error) {
        console.error("Error fetching template:", error);
        return NextResponse.json(
            { error: "Failed to fetch template", details: String(error) },
            { status: 500 }
        );
    }
}

// PUT: Update template
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        checkSupabaseConfig();
        const { id } = await params;
        const body = await request.json();

        const { data, error } = await supabaseAdmin
            .from("templates")
            .update({
                ...body,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, template: data });
    } catch (error) {
        console.error("Error updating template:", error);
        return NextResponse.json(
            { error: "Failed to update template", details: String(error) },
            { status: 500 }
        );
    }
}

// DELETE: Remove template
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        checkSupabaseConfig();
        const { id } = await params;

        const { error } = await supabaseAdmin
            .from("templates")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting template:", error);
        return NextResponse.json(
            { error: "Failed to delete template", details: String(error) },
            { status: 500 }
        );
    }
}
