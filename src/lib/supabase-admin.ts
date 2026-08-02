import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_SECRET;

// Server-side Supabase client with service role (admin privileges)
// We use a conditional check to prevent build-time crashes if environment variables are missing
const _supabaseAdmin = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

// Exported as non-null — checkSupabaseConfig() enforces presence at runtime.
// Cast to `any` because the project doesn't use generated Supabase DB types;
// without them, the strict generics resolve all table references to `never`.
export const supabaseAdmin = _supabaseAdmin as any;

// Helper to ensure supabaseAdmin is available when actually needed
export function checkSupabaseConfig() {
    if (!_supabaseAdmin) {
        throw new Error("Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_SECRET) are missing.");
    }
}


/**
 * Extracts and verifies the authenticated user from the request's Authorization Bearer token.
 * Returns { user, userId } on success, or a 401 Response on failure.
 *
 * Usage in API routes:
 *   const authResult = await getAuthenticatedUser(request);
 *   if (authResult instanceof Response) return authResult;
 *   const { userId } = authResult;
 */
export async function getAuthenticatedUser(
    request: Request
): Promise<{ user: any; userId: string } | Response> {
    let token: string | null = null;

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
    } else {
        try {
            const { searchParams } = new URL(request.url);
            token = searchParams.get("token");
        } catch (e) {}
    }

    if (!token) {
        return new Response(
            JSON.stringify({ error: "Unauthorized: Missing Authorization header or token query parameter" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
        return new Response(
            JSON.stringify({ error: "Server configuration error" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error } = await userClient.auth.getUser(token);

    if (error || !user) {
        return new Response(
            JSON.stringify({ error: "Unauthorized: Invalid or expired session" }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
    }

    return { user, userId: user.id };
}

/**
 * Verifies if the request is made by an authorized admin.
 * Returns the user object if successful, or a standard 401/403 Response if validation fails.
 */
export async function verifyAdminRequest(request: Request): Promise<{ user: any } | Response> {
    const authResult = await getAuthenticatedUser(request);
    if (authResult instanceof Response) return authResult;

    const { user } = authResult;

    checkSupabaseConfig();
    const { data: adminData, error: adminError } = await supabaseAdmin
        .from("admins")
        .select("*")
        .eq("user_id", user.id)
        .single();

    if (adminError || !adminData) {
        return new Response(
            JSON.stringify({ error: "Forbidden: Admin privileges required" }),
            {
                status: 403,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    return { user };
}

/**
 * Gets a user's profile and dynamically resets their monthly free previews limit of 10 if 30 days have passed.
 * Returns the updated profile record.
 */
export async function getOrResetFreePreviews(userId: string) {
    checkSupabaseConfig();
    const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !profile) return null;

    const resetDate = new Date(profile.free_previews_reset_at || profile.created_at || Date.now());
    const now = new Date();

    // Check if more than a month (30 days) has passed since the last reset
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    if (now.getTime() - resetDate.getTime() >= oneMonthMs) {
        const { data: updatedProfile } = await supabaseAdmin
            .from("profiles")
            .update({
                free_previews_remaining: 5,
                free_previews_reset_at: now.toISOString(),
            })
            .eq("id", userId)
            .select()
            .single();

        return updatedProfile || profile;
    }

    return profile;
}

/**
 * Gets a user's profile and dynamically resets their daily free background removals limit of 3 if 24 hours have passed.
 * Returns the updated profile record.
 */
export async function getOrResetFreeBgRemovals(userId: string) {
    checkSupabaseConfig();
    const { data: profile, error } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

    if (error || !profile) return null;

    const resetDate = new Date(profile.free_bg_removals_reset_at || profile.created_at || Date.now());
    const now = new Date();

    // Check if more than 24 hours (1 day) has passed since the last reset
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (now.getTime() - resetDate.getTime() >= oneDayMs) {
        const { data: updatedProfile } = await supabaseAdmin
            .from("profiles")
            .update({
                free_bg_removals_remaining: 3,
                free_bg_removals_reset_at: now.toISOString(),
            })
            .eq("id", userId)
            .select()
            .single();

        return updatedProfile || profile;
    }

    return profile;
}
