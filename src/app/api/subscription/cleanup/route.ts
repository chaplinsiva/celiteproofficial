import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteFromR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/subscription/cleanup
 * Scans for and deletes projects/renders older than 3 days for free users.
 * Should be called by a cron job every 24 hours.
 */
export async function GET() {
    try {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const isoDate = threeDaysAgo.toISOString();

        console.log(`Starting cleanup for data older than ${isoDate}`);

        // 1. Find all users with active subscriptions (to exclude them)
        const { data: activeSubs } = await supabaseAdmin
            .from("user_subscriptions")
            .select("user_id")
            .eq("status", "active")
            .gte("valid_until", new Date().toISOString());

        const subscribedUserIds = activeSubs?.map((s: { user_id: string }) => s.user_id) || [];

        // 2. Delete projects for free users older than 3 days
        let projQuery = supabaseAdmin
            .from("projects")
            .select("id, configuration")
            .lt("updated_at", isoDate);

        if (subscribedUserIds.length > 0) {
            projQuery = projQuery.not("user_id", "in", `(${subscribedUserIds.join(",")})`);
        }

        const { data: oldProjects, error: projError } = await projQuery;

        if (projError) console.error("Error fetching old projects:", projError);

        let projectsDeleted = 0;
        if (oldProjects && oldProjects.length > 0) {
            for (const project of oldProjects) {
                // Potential: Delete R2 assets referenced in configuration
                // But for now, just delete the project record
                const { error } = await supabaseAdmin
                    .from("projects")
                    .delete()
                    .eq("id", project.id);

                if (!error) projectsDeleted++;
            }
        }

        // 3. Delete render jobs and R2 videos for free users older than 3 days
        let renderQuery = supabaseAdmin
            .from("render_jobs")
            .select("id, output_url")
            .lt("created_at", isoDate);

        if (subscribedUserIds.length > 0) {
            renderQuery = renderQuery.not("user_id", "in", `(${subscribedUserIds.join(",")})`);
        }

        const { data: oldRenders, error: renderError } = await renderQuery;

        if (renderError) console.error("Error fetching old renders:", renderError);

        let rendersDeleted = 0;
        if (oldRenders && oldRenders.length > 0) {
            for (const render of oldRenders) {
                // Delete file from R2 if output_url is an R2 URL
                if (render.output_url && render.output_url.includes("r2.cloudflarestorage.com")) {
                    try {
                        const url = new URL(render.output_url);
                        const path = url.pathname.substring(1); // Remove leading slash
                        await deleteFromR2(path);
                    } catch (e) {
                        console.error(`Failed to delete R2 file for render ${render.id}:`, e);
                    }
                }

                const { error } = await supabaseAdmin
                    .from("render_jobs")
                    .delete()
                    .eq("id", render.id);

                if (!error) rendersDeleted++;
            }
        }

        // 4. Delete user uploads (from user_logs) for free users older than 3 days
        let uploadQuery = supabaseAdmin
            .from("user_logs")
            .select("id, file_urls")
            .eq("action", "upload")
            .lt("created_at", isoDate);

        if (subscribedUserIds.length > 0) {
            uploadQuery = uploadQuery.not("user_id", "in", `(${subscribedUserIds.join(",")})`);
        }

        const { data: oldUploads, error: uploadError } = await uploadQuery;

        if (uploadError) console.error("Error fetching old uploads:", uploadError);

        let uploadsDeleted = 0;
        if (oldUploads && oldUploads.length > 0) {
            for (const upload of oldUploads) {
                const urls = upload.file_urls as string[];
                if (urls && Array.isArray(urls)) {
                    for (const fileUrl of urls) {
                        if (fileUrl.includes("r2.cloudflarestorage.com")) {
                            try {
                                const url = new URL(fileUrl);
                                const path = url.pathname.substring(1);
                                await deleteFromR2(path);
                            } catch (e) {
                                console.error(`Failed to delete R2 upload for log ${upload.id}:`, e);
                            }
                        }
                    }
                }

                const { error } = await supabaseAdmin
                    .from("user_logs")
                    .delete()
                    .eq("id", upload.id);

                if (!error) uploadsDeleted++;
            }
        }

        return NextResponse.json({
            success: true,
            cleaned: {
                projects: projectsDeleted,
                renders: rendersDeleted,
                uploads: uploadsDeleted
            }
        });

    } catch (error) {
        console.error("Cleanup error:", error);
        return NextResponse.json(
            { error: "Cleanup failed", details: String(error) },
            { status: 500 }
        );
    }
}
