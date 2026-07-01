import React from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TemplateClient from "./TemplateClient";
import { Metadata } from "next";
import Link from "next/link";
import { getTemplateSEO } from "@/lib/seo";

interface Props {
    params: Promise<{ slug: string }>;
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

    if (!template) {
        return (
            <main className="min-h-screen bg-white">
                <div className="max-w-7xl mx-auto px-4 pt-32 text-center">
                    <h1 className="text-3xl font-bold text-slate-900 mb-4">Template Not Found</h1>
                    <p className="text-slate-500 mb-8">The template you are looking for does not exist.</p>
                    <Link href="/templates" className="text-blue-600 hover:text-blue-700">
                        ← Back to Templates
                    </Link>
                </div>
            </main>
        );
    }

    return <TemplateClient template={template} />;
}
