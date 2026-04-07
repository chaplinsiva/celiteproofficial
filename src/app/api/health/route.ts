import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? "DETECTED" : "MISSING",
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "DETECTED" : "MISSING",
        supabaseServiceKey: process.env.SUPABASE_SERVICE_SECRET ? "DETECTED" : "MISSING",
        plainlyApiKey: process.env.PLAINLY_API_KEY ? "DETECTED" : "MISSING",
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV || "local"
    });
}
