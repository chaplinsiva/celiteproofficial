import React from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TemplateClient from "./TemplateClient";
import { Metadata } from "next";
import Link from "next/link";
import { getTemplateSEO } from "@/lib/seo";

interface Props {
    params: Promise<{ slug: string }>;
}

interface RelatedTemplate {
    id: string;
    slug: string;
    title: string;
    category: string;
    duration: string;
    aspect_ratio: string;
    thumbnail_url: string;
    image_placeholders: { key: string }[];
    text_placeholders: { key: string }[];
    credit_cost: number;
}

async function getTemplate(slug: string) {
    const { data, error } = await supabaseAdmin
        .from("templates")
        .select("*")
        .eq("slug", slug)
        .single();

    if (error) return null;
    return data;
}

async function getRelatedTemplates(slug: string): Promise<RelatedTemplate[]> {
    const { data, error } = await supabaseAdmin
        .from("templates")
        .select("id, slug, title, category, duration, aspect_ratio, thumbnail_url, image_placeholders, text_placeholders, credit_cost")
        .neq("slug", slug)
        .limit(30);

    if (error || !data?.length) return [];

    const shuffled = [...data].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6) as RelatedTemplate[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const seo = await getTemplateSEO(slug);

    if (!seo) {
        return {
            title: "Template Not Found | CelitePro",
        };
    }

    return {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords,
        openGraph: {
            title: seo.title,
            description: seo.description,
            images: seo.og_image ? [seo.og_image] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: seo.title,
            description: seo.description,
            images: seo.og_image ? [seo.og_image] : undefined,
        }
    };
}

export default async function TemplatePage({ params }: Props) {
    const { slug } = await params;
    const template = await getTemplate(slug);
    const relatedTemplates = await getRelatedTemplates(slug);

    if (!template) {
        return (
            <main className="min-h-screen bg-[#0A0A0B]">
                <div className="max-w-7xl mx-auto px-4 pt-32 text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Template Not Found</h1>
                    <p className="text-gray-500 mb-8">The template you are looking for does not exist.</p>
                    <Link href="/templates" className="text-indigo-400 hover:text-indigo-300">
                        ← Back to Templates
                    </Link>
                </div>
            </main>
        );
    }

    return <TemplateClient template={template} relatedTemplates={relatedTemplates} />;
}
