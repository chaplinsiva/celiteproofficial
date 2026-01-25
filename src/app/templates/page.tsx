import React from "react";
import TemplatesClient from "./TemplatesClient";
import { Metadata } from "next";
import { getPageSEO } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
    const seo = await getPageSEO('/templates');

    return {
        title: seo?.title || "Templates | CelitePro",
        description: seo?.description || "Browse our marketplace of professional video templates.",
        keywords: seo?.keywords || "video templates, marketplace",
        openGraph: {
            title: seo?.title,
            description: seo?.description,
            images: seo?.og_image ? [seo.og_image] : undefined,
        }
    };
}

export default function TemplatesPage() {
    return <TemplatesClient />;
}
