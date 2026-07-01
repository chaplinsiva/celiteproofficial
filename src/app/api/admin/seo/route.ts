import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, verifyAdminRequest } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: List all SEO entries
export async function GET(request: Request) {
    try {
        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        checkSupabaseConfig();
        const { data, error } = await supabaseAdmin
            .from("site_seo")
            .select("*")
            .order("page_path", { ascending: true });

        if (error) throw error;

        return NextResponse.json({ seo: data });
    } catch (error) {
        console.error("Error fetching SEO:", error);
        return NextResponse.json(
            { error: "Failed to fetch SEO", details: String(error) },
            { status: 500 }
        );
    }
}

// POST: Upsert SEO entry
export async function POST(request: NextRequest) {
    try {
        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        checkSupabaseConfig();
        const body = await request.json();

        const { page_path, title, description, keywords } = body;

        if (!page_path || !title) {
            return NextResponse.json(
                { error: "Path and title are required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("site_seo")
            .upsert({
                page_path,
                title,
                description,
                keywords,
                updated_at: new Date().toISOString()
            }, { onConflict: 'page_path' })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, seo: data });
    } catch (error) {
        console.error("Error saving SEO:", error);
        return NextResponse.json(
            { error: "Failed to save SEO", details: String(error) },
            { status: 500 }
        );
    }
}
