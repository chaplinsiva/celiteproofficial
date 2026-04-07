import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const { jobId, userId } = await request.json();

        if (jobId) {
            // Mark specific job as viewed
            const { error } = await supabaseAdmin
                .from("render_jobs")
                .update({ is_viewed: true })
                .eq("id", jobId);

            if (error) throw error;
        } else if (userId) {
            // Mark all jobs for user as viewed
            const { error } = await supabaseAdmin
                .from("render_jobs")
                .update({ is_viewed: true })
                .eq("user_id", userId)
                .eq("is_viewed", false);

            if (error) throw error;
        } else {
            return NextResponse.json({ error: "Job ID or User ID is required" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Mark viewed error:", error);
        return NextResponse.json({ error: "Failed to mark as viewed" }, { status: 500 });
    }
}
