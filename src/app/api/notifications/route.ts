import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        // Fetch unviewed render jobs with template info
        const { data, error } = await supabaseAdmin
            .from("render_jobs")
            .select(`
                *,
                template:templates (
                    title,
                    thumbnail_url
                )
            `)
            .eq("user_id", userId)
            .eq("is_viewed", false)
            .order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ notifications: data });
    } catch (error) {
        console.error("Notifications fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}
