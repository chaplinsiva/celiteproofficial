import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, verifyAdminRequest } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET: Read platform settings
 * PUT: Update platform settings (admin only)
 *
 * Settings are stored in a single-row `site_settings` table with key-value columns.
 */

// Ensure the site_settings row exists (upsert a default if missing)
async function ensureSettingsRow() {
    const { data } = await supabaseAdmin
        .from("site_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

    if (!data) {
        const { data: created, error } = await supabaseAdmin
            .from("site_settings")
            .insert({ maintenance_mode: false })
            .select()
            .single();
        if (error) throw error;
        return created;
    }
    return data;
}

// GET — public read (used by middleware to check maintenance mode)
export async function GET() {
    try {
        checkSupabaseConfig();
        const settings = await ensureSettingsRow();
        return NextResponse.json({ settings });
    } catch (error) {
        console.error("Error reading site settings:", error);
        return NextResponse.json(
            { error: "Failed to read settings" },
            { status: 500 }
        );
    }
}

// PUT — admin-only write
export async function PUT(request: NextRequest) {
    try {
        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        checkSupabaseConfig();
        const body = await request.json();

        // Build safe update
        const updateData: Record<string, any> = {};
        if (body.maintenance_mode !== undefined) {
            updateData.maintenance_mode = Boolean(body.maintenance_mode);
        }
        if (body.maintenance_message !== undefined) {
            updateData.maintenance_message = String(body.maintenance_message);
        }
        updateData.updated_at = new Date().toISOString();

        // Ensure row exists before updating
        await ensureSettingsRow();

        const { data, error } = await supabaseAdmin
            .from("site_settings")
            .update(updateData)
            .not("id", "is", null) // update all rows (there's only one)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, settings: data });
    } catch (error) {
        console.error("Error updating site settings:", error);
        return NextResponse.json(
            { error: "Failed to update settings" },
            { status: 500 }
        );
    }
}
