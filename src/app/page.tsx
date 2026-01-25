import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TemplateListing from "@/components/TemplateListing";
import { Metadata } from "next";
import { getPageSEO } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSEO('/');

  return {
    title: seo?.title || "CelitePro | Video Editor tool",
    description: seo?.description || "Professional Video Editor tool for creators.",
    keywords: seo?.keywords || "video editor, automation",
    openGraph: {
      title: seo?.title,
      description: seo?.description,
      images: seo?.og_image ? [seo.og_image] : undefined,
    }
  };
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0A0A0B]">
      <Header />
      <Hero />
      <TemplateListing />

      {/* Features/Stats Section (Quick addition for 'wow' factor) */}
      <section className="py-24 bg-[#0A0A0B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: "Rendering Speed", value: "10x Faster", desc: "Our cloud engine processes 4K video faster than real-time." },
              { label: "API Available", value: "REST & SDK", desc: "Integrate Video Editor tool features into your existing applications." },
              { label: "Templates", value: "500+", desc: "Curated collection of professional After Effects templates." }
            ].map((stat, i) => (
              <div key={i} className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
                <div className="text-sm font-medium text-indigo-400 mb-2">{stat.label}</div>
                <div className="text-3xl font-bold text-white mb-3 group-hover:text-indigo-400 transition-colors">{stat.value}</div>
                <p className="text-gray-500 text-sm leading-relaxed">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
