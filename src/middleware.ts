import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Next.js Edge Middleware — lightweight request handler.
 *
 * IMPORTANT: This project uses the standard `@supabase/supabase-js` browser
 * client which stores auth tokens in **localStorage**, NOT in cookies.
 * Because Edge Middleware cannot access localStorage, we CANNOT reliably
 * determine auth state here.
 *
 * Auth protection is handled client-side:
 *   - Dashboard page checks `supabase.auth.getUser()` and redirects if null
 *   - Render page is non-destructive (read-only status view)
 *   - Editor / Checkout pages check auth before mutations
 *
 * MAINTENANCE MODE:
 *   - Reads the `maintenance_mode` flag from the `site_settings` table
 *   - If ON, redirects all non-admin, non-exempt requests to /maintenance
 *   - Admin users are identified by their JWT → admins table lookup
 *   - Exempt paths: /admin, /login, /signup, /maintenance, /api, /_next, static assets
 */

// Lightweight Supabase client for edge — no auth persistence needed
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // ── Exempt paths — never block these ─────────────────────────────────
    const exemptPrefixes = [
        "/maintenance",
        "/admin",
        "/login",
        "/signup",
        "/api/",
        "/_next",
        "/favicon",
        "/robots",
        "/sitemap",
    ];

    if (exemptPrefixes.some((p) => pathname.startsWith(p)) || pathname === "/") {
        // Allow homepage through but check maintenance for it too — except true exempts
        if (pathname !== "/" || exemptPrefixes.some((p) => pathname.startsWith(p) && pathname !== "/")) {
            return NextResponse.next();
        }
    }

    // ── Check maintenance mode ───────────────────────────────────────────
    try {
        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.next();
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: settings } = await supabaseAdmin
            .from("site_settings")
            .select("maintenance_mode")
            .limit(1)
            .maybeSingle();

        if (!settings?.maintenance_mode) {
            // Maintenance mode is OFF — pass through
            return NextResponse.next();
        }

        // ── Maintenance is ON — check if the user is an admin ────────────
        const token = request.headers.get("authorization")?.replace("Bearer ", "")
            || request.cookies.get("sb-access-token")?.value
            || extractTokenFromCookie(request);

        if (token) {
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);

            if (user) {
                const { data: adminData } = await supabaseAdmin
                    .from("admins")
                    .select("id")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (adminData) {
                    // Admin user — allow through
                    return NextResponse.next();
                }
            }
        }

        // ── Non-admin or unauthenticated during maintenance — redirect ───
        const maintenanceUrl = new URL("/maintenance", request.url);
        return NextResponse.redirect(maintenanceUrl);

    } catch (err) {
        // If the check fails (DB down, etc.), fail open — don't block users
        console.error("[Middleware] Maintenance check failed:", err);
        return NextResponse.next();
    }
}

/**
 * Try to extract the Supabase access token from the cookie jar.
 * Supabase stores it in a cookie named `sb-<project-ref>-auth-token`.
 */
function extractTokenFromCookie(request: NextRequest): string | null {
    for (const [name, cookie] of request.cookies.getAll().map(c => [c.name, c.value])) {
        if (name.includes("auth-token") || name.includes("sb-")) {
            try {
                // Supabase stores JSON in the cookie; the access_token is inside
                const parsed = JSON.parse(cookie);
                if (parsed?.access_token) return parsed.access_token;
                // Sometimes it's a direct token string
                if (typeof parsed === "string") return parsed;
            } catch {
                // It might be the raw token
                if (cookie.startsWith("eyJ")) return cookie;
            }
        }
    }
    return null;
}

export const config = {
    matcher: [
        // Match all paths that should be checked for maintenance
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot)).*)",
    ],
};
