import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    try {
        const { jobId } = await request.json();

        if (jobId) {
            // Mark specific job as viewed — enforce ownership to prevent IDOR
            const { error } = await supabaseAdmin
                .from("render_jobs")
                .update({ is_viewed: true })
                .eq("id", jobId)
                .eq("user_id", userId);

            if (error) throw error;
        } else {
            // Mark all jobs for the authenticated user as viewed
            const { error } = await supabaseAdmin
                .from("render_jobs")
                .update({ is_viewed: true })
                .eq("user_id", userId)
                .eq("is_viewed", false);

            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Mark viewed error:", error);
        return NextResponse.json({ error: "Failed to mark as viewed" }, { status: 500 });
    }
}
