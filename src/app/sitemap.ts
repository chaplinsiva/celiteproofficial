import { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://celitepro.com'; // Adjust this to your actual domain

    // Fetch all active templates for dynamic routes
    const { data: templates } = await supabaseAdmin
        .from('templates')
        .select('slug, updated_at')
        .eq('is_active', true);

    const templateEntries: MetadataRoute.Sitemap = (templates || []).map((template: any) => ({
        url: `${baseUrl}/templates/${template.slug}`,
        lastModified: template.updated_at ? new Date(template.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
    }));

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/templates`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/contact`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/privacy-policy`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
    ];

    return [...staticPages, ...templateEntries];
}
