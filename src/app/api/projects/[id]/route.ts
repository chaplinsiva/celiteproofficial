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

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: "Project not found" }, { status: 404 });
            }
            throw error;
        }

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

        // 1. Fetch project to get configuration and assets
        const { data: project, error: fetchError } = await supabaseAdmin
            .from("projects")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (fetchError || !project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const configuration = project.configuration as any;
        const r2FilesToDelete: string[] = [];

        // 2. Find assets in configuration
        if (configuration?.images) {
            for (const urlStr of Object.values(configuration.images) as string[]) {
                if (urlStr && urlStr.includes("r2.cloudflarestorage.com")) {
                    try {
                        const url = new URL(urlStr);
                        r2FilesToDelete.push(url.pathname.substring(1));
                    } catch (e) { }
                }
            }
        }

        // 3. Find associated render jobs and their videos
        const { data: jobs } = await supabaseAdmin
            .from("render_jobs")
            .select("id, output_url")
            .eq("project_id", id);

        if (jobs) {
            for (const job of jobs) {
                if (job.output_url && job.output_url.includes("r2.cloudflarestorage.com")) {
                    try {
                        const url = new URL(job.output_url);
                        r2FilesToDelete.push(url.pathname.substring(1));
                    } catch (e) { }
                }
            }
        }

        // 4. Delete files from R2
        const { deleteFromR2 } = await import("@/lib/r2");
        for (const path of r2FilesToDelete) {
            try {
                await deleteFromR2(path);
            } catch (e) {
                console.error(`Failed to delete R2 file ${path}:`, e);
            }
        }

        // 6. Delete the project (records in DB) and jobs
        if (jobs && jobs.length > 0) {
            await supabaseAdmin.from("render_jobs").delete().in("id", jobs.map((j: { id: string }) => j.id));
        }

        const { error } = await supabaseAdmin
            .from("projects")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (error) throw error;

        return NextResponse.json({ success: true, filesDeleted: r2FilesToDelete.length });
    } catch (error) {
        console.error("Project delete error:", error);
        return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }
}
