import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, getAuthenticatedUser } from "@/lib/supabase-admin";
import { getPresignedDownloadUrl, getR2KeyFromUrl } from "@/lib/r2";

async function signProjectConfiguration(configuration: any) {
    if (!configuration || !configuration.images) return configuration;

    const signedImages = { ...configuration.images };
    for (const [key, url] of Object.entries(signedImages)) {
        if (typeof url === "string" && (url.includes("r2.cloudflarestorage.com") || url.includes("pub-") || url.includes("files.celitepro.in") || url.includes("cdn.celite.in"))) {
            try {
                const s3Key = getR2KeyFromUrl(url);
                signedImages[key] = await getPresignedDownloadUrl(s3Key);
            } catch (err) {
                console.error(`Failed to pre-sign user image placeholder ${key}:`, err);
            }
        }
    }

    return {
        ...configuration,
        images: signedImages
    };
}

export async function GET(request: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Server configuration error: missing Supabase service key" }, { status: 500 });
        }

        const authResult = await getAuthenticatedUser(request);
        if (authResult instanceof Response) return authResult;
        const { userId } = authResult;

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
            .eq("is_hidden", false)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        if (data) {
            await Promise.all(data.map(async (project: any) => {
                if (project.configuration) {
                    project.configuration = await signProjectConfiguration(project.configuration);
                }
            }));
        }

        return NextResponse.json({ projects: data });
    } catch (error) {
        console.error("Project fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: "Server configuration error: missing Supabase service key" }, { status: 500 });
        }

        const authResult = await getAuthenticatedUser(request);
        if (authResult instanceof Response) return authResult;
        const { userId } = authResult;

        const body = await request.json();
        const { id, templateId, name, configuration } = body;

        if (!templateId || !name) {
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
