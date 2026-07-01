import { NextRequest, NextResponse } from "next/server";
import { checkSupabaseConfig, supabaseAdmin, verifyAdminRequest } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// GET: Fetch single template
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        checkSupabaseConfig();

        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        const { id } = await params;

        const { data, error } = await supabaseAdmin
            .from("templates")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;

        return NextResponse.json({ template: data });
    } catch (error) {
        console.error("Error fetching template:", error);
        return NextResponse.json(
            { error: "Failed to fetch template" },
            { status: 500 }
        );
    }
}

// PUT: Update template
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        checkSupabaseConfig();
        const { id } = await params;
        const body = await request.json();

        const {
            title,
            description,
            slug,
            price,
            credit_cost,
            is_active,
            source_url,
            preview_url,
            thumbnail_url,
            plainly_project_id,
            plainly_template_name,
            layers,
            category,
            duration,
            aspect_ratio,
            image_placeholders,
            text_placeholders,
            meta_title,
            meta_description,
            keywords,
            one_time_price,
            is_premium
        } = body;
        const updateData: Record<string, any> = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (slug !== undefined) updateData.slug = slug;
        if (price !== undefined) updateData.price = Number(price);
        if (credit_cost !== undefined) updateData.credit_cost = Number(credit_cost);
        if (is_active !== undefined) updateData.is_active = Boolean(is_active);
        if (source_url !== undefined) updateData.source_url = source_url;
        if (preview_url !== undefined) updateData.preview_url = preview_url;
        if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;
        if (plainly_project_id !== undefined) updateData.plainly_project_id = plainly_project_id;
        if (plainly_template_name !== undefined) updateData.plainly_template_name = plainly_template_name;
        if (layers !== undefined) updateData.layers = layers;
        if (category !== undefined) updateData.category = category;
        if (duration !== undefined) updateData.duration = duration;
        if (aspect_ratio !== undefined) updateData.aspect_ratio = aspect_ratio;
        if (image_placeholders !== undefined) updateData.image_placeholders = image_placeholders;
        if (text_placeholders !== undefined) updateData.text_placeholders = text_placeholders;
        if (meta_title !== undefined) updateData.meta_title = meta_title;
        if (meta_description !== undefined) updateData.meta_description = meta_description;
        if (keywords !== undefined) updateData.keywords = keywords;
        if (one_time_price !== undefined) updateData.one_time_price = Number(one_time_price);
        if (is_premium !== undefined) updateData.is_premium = Boolean(is_premium);
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from("templates")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, template: data });
    } catch (error) {
        console.error("Error updating template:", error);
        return NextResponse.json(
            { error: "Failed to update template" },
            { status: 500 }
        );
    }
}

// DELETE: Remove template
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminCheck = await verifyAdminRequest(request);
        if (adminCheck instanceof Response) return adminCheck;

        checkSupabaseConfig();
        const { id } = await params;

        const { error } = await supabaseAdmin
            .from("templates")
            .delete()
            .eq("id", id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting template:", error);
        return NextResponse.json(
            { error: "Failed to delete template" },
            { status: 500 }
        );
    }
}
