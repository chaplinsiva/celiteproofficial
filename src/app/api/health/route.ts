import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    // Only return a simple OK status — do not expose environment details
    return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
}
