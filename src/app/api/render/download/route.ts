import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser, supabaseAdmin } from "@/lib/supabase-admin";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME, getR2KeyFromUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/render/download?url=<CDN_URL>&filename=<optional>
 *
 * Proxies the video file from Cloudflare R2 CDN and streams it back to
 * the browser with a Content-Disposition: attachment header so the browser
 * downloads the file instead of opening / playing it.
 *
 * Only allows URLs that belong to the project's own CDN domain to prevent
 * abuse as an open proxy.
 */
export async function GET(request: NextRequest) {
    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    // Sanitize filename: strip everything except word chars, spaces, dots, hyphens
    const safeFilename = (searchParams.get("filename") || "CelitePro-Video.mp4")
        .replace(/[^\w\s.-]/g, "_")
        .slice(0, 200);

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // ── Security: only proxy requests to our own CDN ────────────────────────
    const cdnBase = process.env.NEXT_PUBLIC_S3_URL || "";
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        const cdnHostname = cdnBase ? new URL(cdnBase).hostname : "";
        const isAllowed =
            (cdnHostname && hostname === cdnHostname) ||
            hostname.endsWith(".r2.cloudflarestorage.com") ||
            hostname === "cdn.celite.in" ||
            hostname === "files.celitepro.in";
        if (!isAllowed) {
            return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const key = getR2KeyFromUrl(url);

    // Verify ownership or admin access
    const { userId } = authResult;
    const { data: job } = await supabaseAdmin
        .from("render_jobs")
        .select("id")
        .ilike("output_url", `%${key}`)
        .eq("user_id", userId)
        .maybeSingle();

    let isAuthorized = false;
    if (job) {
        isAuthorized = true;
    } else {
        const { data: adminRecord } = await supabaseAdmin
            .from("admins")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        if (adminRecord) {
            const { data: adminJob } = await supabaseAdmin
                .from("render_jobs")
                .select("id")
                .ilike("output_url", `%${key}`)
                .maybeSingle();
            if (adminJob) {
                isAuthorized = true;
            }
        }
    }

    if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized or file not found" }, { status: 403 });
    }

    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        const s3Response = await r2Client.send(command);

        const headers = new Headers();
        headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
        headers.set("Content-Type", s3Response.ContentType || "video/mp4");
        if (s3Response.ContentLength) {
            headers.set("Content-Length", s3Response.ContentLength.toString());
        }

        // Stream the body straight through — no buffering the whole file in memory
        return new NextResponse(s3Response.Body as any, {
            status: 200,
            headers,
        });
    } catch (err) {
        console.error("Download proxy error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
