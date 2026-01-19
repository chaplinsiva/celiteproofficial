import React from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import TemplateClient from "./TemplateClient";
import { Metadata } from "next";
import Header from "@/components/Header";
import Link from "next/link";

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
    const template = await getTemplate(slug);

    if (!template) {
        return {
            title: "Template Not Found | CelitePro",
        };
    }

    return {
        title: `${template.title} | CelitePro`,
        description: template.description || `Professional Video Editor tool: Customize ${template.title} and render in minutes.`,
        openGraph: {
            title: `${template.title} | CelitePro`,
            description: template.description || `Customize ${template.title} and render in minutes.`,
            images: [template.thumbnail_url || `${process.env.PUBLIC_URL_S3}/logos/02.png`],
        },
        twitter: {
            card: "summary_large_image",
            title: `${template.title} | CelitePro`,
            description: template.description || `Customize ${template.title} and render in minutes.`,
            images: [template.thumbnail_url || `${process.env.PUBLIC_URL_S3}/logos/02.png`],
        }
    };
}

export default async function TemplatePage({ params }: Props) {
    const { slug } = await params;
    const template = await getTemplate(slug);

    if (!template) {
        return (
            <main className="min-h-screen bg-[#0A0A0B]">
                <Header />
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

    return <TemplateClient template={template} />;
}
