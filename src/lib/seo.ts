import { supabaseAdmin } from "./supabase-admin";

export interface SEOData {
    title: string;
    description: string;
    keywords?: string;
    og_image?: string;
}

export async function getPageSEO(path: string): Promise<SEOData | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from("site_seo")
            .select("*")
            .eq("page_path", path)
            .single();

        if (error) {
            console.error(`Error fetching SEO for ${path}:`, error.message);
            return null;
        }

        return {
            title: data.title,
            description: data.description,
            keywords: data.keywords,
            og_image: data.og_image
        };
    } catch (err) {
        console.error(`Unexpected error fetching SEO for ${path}:`, err);
        return null;
    }
}

export async function getTemplateSEO(slug: string): Promise<SEOData | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from("templates")
            .select("title, description, meta_title, meta_description, keywords, thumbnail_url")
            .eq("slug", slug)
            .single();

        if (error) {
            console.error(`Error fetching template SEO for ${slug}:`, error.message);
            return null;
        }

        return {
            title: data.meta_title || `${data.title} | CelitePro`,
            description: data.meta_description || data.description || `Professional Video Editor tool: Customize ${data.title} and render in minutes.`,
            keywords: data.keywords,
            og_image: data.thumbnail_url
        };
    } catch (err) {
        console.error(`Unexpected error fetching template SEO for ${slug}:`, err);
        return null;
    }
}
