import Hero from "@/components/Hero";
import TemplateListing from "@/components/TemplateListing";
import { Metadata } from "next";
import { getPageSEO } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSEO('/');

  return {
    title: seo?.title || "CelitePro | #1 Video Template Maker",
    description: seo?.description || "Rank #1 Video Template Maker. Edit professional video templates, create online intros, slideshows, and customize your edits in minutes.",
    keywords: seo?.keywords || "video template maker, video template, video template edit, edit video online, intro video editor, slideshow video maker, online video editing",
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
      <Hero />
      <TemplateListing />



      {/* Advanced SEO Content Block */}
      <section className="py-24 bg-gradient-to-b from-[#0A0A0B] to-black border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Online Video Editing Made Simple</h2>
          <p className="text-gray-400 leading-relaxed mb-8">
            Looking for the perfect <strong className="text-gray-300">video template</strong>? Our <strong className="text-gray-300">online video maker</strong> provides everything you need to create stunning, studio-quality <strong className="text-gray-300">intros and slideshows</strong> and elegant <strong className="text-gray-300">custom promo videos</strong> directly in your browser. Whether you want a quick <strong className="text-gray-300">video edit</strong> online or complex <strong className="text-gray-300">motion graphics</strong>, our advanced <strong className="text-gray-300">video editor</strong> automates the entire process so you render 10x faster.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Premium Video Templates", "Intro Video Maker", "Edit Videos Online", "Slideshow Maker", "Custom Motion Graphics"].map((keyword, i) => (
              <span key={i} className="px-4 py-2 rounded-full bg-white/[0.03] border border-white/10 text-xs text-indigo-300 font-medium whitespace-nowrap">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section for SEO */}
      <section className="py-24 bg-[#0A0A0B] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-400">Everything you need to know about our video template maker.</p>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xl font-semibold text-white mb-3">How do I create a custom video edit online?</h3>
              <p className="text-gray-400 leading-relaxed">
                Creating your custom video is incredibly easy. Simply browse our curated collection of premium video templates, choose your favorite design, upload your photos or videos, and customize the text. Our powerful render engine handles all the complex motion graphics automatically.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xl font-semibold text-white mb-3">Can I make intros and slideshows online?</h3>
              <p className="text-gray-400 leading-relaxed">
                Yes! We offer a wide variety of specialized templates for intros, slideshows, and promos. You can complete your entire video editing process within minutes directly from your browser, without needing any complex editing software.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h3 className="text-xl font-semibold text-white mb-3">Are the video templates customizable?</h3>
              <p className="text-gray-400 leading-relaxed">
                Absolutely. Our advanced online video editing platform allows you to modify colors, fonts, music, and media. Every video template can be personalized to perfectly match your brand and tone.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
