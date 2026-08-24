import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import TemplateListing from "@/components/TemplateListing";
import VideoShowcase from "@/components/VideoShowcase";
import { Metadata } from "next";
import { getPageSEO } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getPageSEO('/');

  return {
    title: seo?.title || "CelitePro | #1 Wedding Invitation Video Maker",
    description: seo?.description || "Rank #1 Wedding Invitation Video Maker. Edit professional wedding templates, create online save the date videos, and customize your wedding invitation edits in minutes.",
    keywords: seo?.keywords || "wedding invitation video maker, wedding template, wedding invitation edit, edit wedding invitation online, wedding save the date editing, save the date video maker, online wedding video editing",
    openGraph: {
      title: seo?.title,
      description: seo?.description,
      images: seo?.og_image ? [seo.og_image] : undefined,
    }
  };
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <TemplateListing />
      <HowItWorks />
      <VideoShowcase />

      {/* Advanced SEO Content Block */}
      <section className="py-24 bg-slate-50 border-t border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Online Wedding Invitation Edit Made Simple</h2>
          <p className="text-slate-500 leading-relaxed mb-8">
            Looking for the perfect <strong className="text-slate-700">wedding template</strong>? Our <strong className="text-slate-700">wedding invitation video maker</strong> provides everything you need to create stunning, studio-quality <strong className="text-slate-700">save the date video editing</strong> projects and elegant <strong className="text-slate-700">custom wedding video</strong> reels directly in your browser. Whether you want a quick <strong className="text-gray-700">wedding invitation edit</strong> online or complex <strong className="text-slate-700">wedding motion graphics</strong>, our advanced <strong className="text-slate-700">wedding video editor</strong> automates the entire process so you render 10x faster.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["Premium Wedding Templates", "Save The Date Video Maker", "Edit Wedding Invitation Online", "Wedding Reel Edit", "Custom Wedding Video"].map((keyword, i) => (
              <span key={i} className="px-4 py-2 rounded-full bg-white border border-slate-200 text-xs text-blue-600 font-medium whitespace-nowrap shadow-sm">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section for SEO */}
      <section className="py-24 bg-white border-t border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
            <p className="text-slate-500">Everything you need to know about our wedding invitation video maker.</p>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-slate-200/60 bg-slate-50">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">How do I create a wedding invitation edit online?</h3>
              <p className="text-slate-600 leading-relaxed font-normal text-sm">
                Creating your custom wedding video is incredibly easy. Simply browse our curated collection of premium wedding templates, choose your favorite design, upload your photos or videos, and customize the text. Our powerful render engine handles all the complex wedding motion graphics automatically.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/60 bg-slate-50">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Can I make a save the date video online?</h3>
              <p className="text-slate-600 leading-relaxed font-normal text-sm">
                Yes! We offer a wide variety of specialized save the date video templates. You can complete your entire save the date video editing process within minutes directly from your browser, without needing any complex editing software.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200/60 bg-slate-50">
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Are the wedding templates customizable?</h3>
              <p className="text-slate-600 leading-relaxed font-normal text-sm">
                Absolutely. Our advanced online wedding video editing platform allows you to modify colors, fonts, music, and media. Every wedding invitation edit can be personalized to perfectly match the theme and tone of your special day.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
