import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_SECRET;

// Server-side Supabase client with service role (admin privileges)
// We use a conditional check to prevent build-time crashes if environment variables are missing
export const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null as any;

// Helper to ensure supabaseAdmin is available when actually needed
export function checkSupabaseConfig() {
    if (!supabaseAdmin) {
        throw new Error("Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_SECRET) are missing.");
    }
}
